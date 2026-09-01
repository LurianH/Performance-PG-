import { supabase } from '../lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataImportRow, ImportChannelOperationalSummary, ImportOperationalSummary } from '../types/database.types'
import { decodeBytes, IMPORT_ALGORITHM_VERSION, prevalidateDelimitedText, serializeMappings, sha256Hex } from '../features/imports/parser'
import { calculateCoverage, readImportChannels, readImportDescriptor, summarizeFlags, summarizeImportSnapshot, type ImportFlagRecord } from '../features/imports/operational-summary'
import { flagRecoveryKey, groupFlagsByColumn, missingFlags, missingMeasurements, rawRecoveryKey, recoveryBatches } from '../features/imports/recovery'
import type { ColumnMapping, Delimiter, FileEncoding, HeaderMode, ImportSource, ObjectiveFlag, PrevalidationResult } from '../features/imports/types'

export const DEFAULT_IMPORT_BATCH_SIZE = 500
export const HYDRAULIC_IMPORT_BUCKET = 'hydraulic-imports'

function client() {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}

export async function findExistingImport(hash: string, source: ImportSource): Promise<DataImportRow | null> {
  let query = client().from('data_imports').select('*').eq('file_hash', hash).eq('source_type', source.type)
  query = source.type === 'DMC' ? query.eq('dmc_id', source.dmc.id) : query.eq('supply_group', source.supplyGroup)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data as DataImportRow | null
}

export async function listImports(): Promise<DataImportRow[]> {
  const values: DataImportRow[] = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client().from('data_imports').select('*').order('imported_at', { ascending: false }).range(from, from + pageSize - 1)
    if (error) throw error
    values.push(...(data ?? []) as DataImportRow[])
    if ((data ?? []).length < pageSize) return values
  }
}

async function listImportFlags(importId: string): Promise<Array<ImportFlagRecord & { raw_measurements: { channel_type: string } }>> {
  const values: Array<ImportFlagRecord & { raw_measurements: { channel_type: string } }> = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client().from('measurement_quality_flags').select('flag_type,severity,details,raw_measurements!inner(import_id,channel_type)').eq('raw_measurements.import_id', importId).range(from, from + pageSize - 1)
    if (error) throw error
    values.push(...(data ?? []) as unknown as Array<ImportFlagRecord & { raw_measurements: { channel_type: string } }>)
    if ((data ?? []).length < pageSize) return values
  }
}

export async function getImportSummary(item: DataImportRow): Promise<ImportOperationalSummary> {
  const descriptor = readImportDescriptor(item)
  const descriptors = readImportChannels(item)
  const [flagRows, rejectedResult] = await Promise.all([
    listImportFlags(item.id),
    client().from('import_rejected_rows').select('id', { count: 'exact', head: true }).eq('import_id', item.id),
  ])
  if (rejectedResult.error) throw rejectedResult.error
  const channels: ImportChannelOperationalSummary[] = []
  for (const channel of descriptors) {
    const baseRaw = () => client().from('raw_measurements').select('raw_value').eq('import_id', item.id).eq('channel_type', channel.channelType)
    const [countResult, minimumResult, maximumResult] = await Promise.all([
      client().from('raw_measurements').select('id', { count: 'exact', head: true }).eq('import_id', item.id).eq('channel_type', channel.channelType),
      baseRaw().not('raw_value', 'is', null).order('raw_value', { ascending: true }).limit(1).maybeSingle(),
      baseRaw().not('raw_value', 'is', null).order('raw_value', { ascending: false }).limit(1).maybeSingle(),
    ])
    const error = countResult.error ?? minimumResult.error ?? maximumResult.error
    if (error) throw error
    const rawCount = countResult.count ?? 0
    const quality = summarizeFlags(flagRows.filter((row) => row.raw_measurements.channel_type === channel.channelType))
    channels.push({ ...channel, rawCount, minimum: minimumResult.data?.raw_value == null ? null : Number(minimumResult.data.raw_value), maximum: maximumResult.data?.raw_value == null ? null : Number(maximumResult.data.raw_value), flags: quality.total, flagBreakdown: quality.breakdown, gaps: quality.gaps, missingTimestamps: quality.missingTimestamps, coveragePercent: calculateCoverage(descriptor.firstReading, descriptor.lastReading, descriptor.cadenceMinutes, rawCount) })
  }
  const rawCount = channels.reduce((total, channel) => total + channel.rawCount, 0)
  const quality = summarizeFlags(flagRows)
  const coverageValues = channels.map((channel) => channel.coveragePercent).filter((value): value is number => value !== null)
  return {
    import: item,
    firstReading: descriptor.firstReading,
    lastReading: descriptor.lastReading,
    rawCount,
    flags: quality.total,
    flagBreakdown: quality.breakdown,
    gaps: quality.gaps,
    missingTimestamps: quality.missingTimestamps,
    coveragePercent: coverageValues.length ? coverageValues.reduce((total, value) => total + value, 0) / coverageValues.length : null,
    rejections: rejectedResult.count ?? item.rejected_count,
    channels,
  }
}

export async function listImportSummaries(): Promise<ImportOperationalSummary[]> {
  return (await listImports()).map(summarizeImportSnapshot)
}

function batches<T>(values: T[], size: number): T[][] {
  return recoveryBatches(values, size)
}

function mappingsFromSnapshot(snapshot: unknown): ColumnMapping[] {
  if (!Array.isArray(snapshot)) throw new Error('Snapshot de mapeamento inválido; retomada bloqueada.')
  return snapshot.map((entry, index) => {
    const value = entry as Record<string, unknown>
    const columnIndex = Number(value.column_index)
    const channelType = String(value.channel_type) as ColumnMapping['channelType']
    if (!Number.isInteger(columnIndex) || !['IGNORE', 'TIMESTAMP', 'PRESSURE_PC', 'PRESSURE_UPSTREAM', 'PRESSURE_DOWNSTREAM', 'PRESSURE_SUPPLY', 'FLOW', 'OTHER'].includes(channelType)) throw new Error(`Mapeamento inválido na posição ${index + 1}.`)
    return { index: columnIndex, headerOriginal: typeof value.header_original === 'string' ? value.header_original : null, displayName: typeof value.display_name === 'string' ? value.display_name : `Coluna ${columnIndex + 1}`, headerNormalized: '', channelType, unit: typeof value.unit === 'string' ? value.unit : null, confidence: 'HIGH' }
  })
}

function metadataFromSnapshot(snapshot: unknown): { encoding: FileEncoding; delimiter: Delimiter; headerMode: HeaderMode } {
  const value = (snapshot ?? {}) as Record<string, unknown>
  const encoding = value.encoding === 'WINDOWS-1252' ? 'WINDOWS-1252' : 'UTF-8'
  const delimiter = value.delimiter === ',' || value.delimiter === '\t' ? value.delimiter : ';'
  const headerMode = value.has_header === true ? 'PRESENT' : 'ABSENT'
  return { encoding, delimiter, headerMode }
}

export interface ExecuteImportInput {
  file: File
  bytes: ArrayBuffer
  hash: string
  source: ImportSource
  mappings: ColumnMapping[]
  hasHeader: boolean
  prevalidation: PrevalidationResult
  encoding: string
  delimiter: string | null
  userId: string
  batchSize?: number
  signal?: AbortSignal
  onProgress?: (processed: number, total: number) => void
}

export async function executeImport(input: ExecuteImportInput): Promise<DataImportRow> {
  const existing = await findExistingImport(input.hash, input.source)
  if (existing) throw new Error('Este arquivo já foi importado.')
  const extension = input.file.name.split('.').pop()?.toLowerCase() ?? ''
  const importId = crypto.randomUUID()
  const safeName = input.file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${input.userId}/${importId}/${safeName}`
  const mappingJson = serializeMappings(input.mappings, input.hasHeader)
  const metadataJson = { encoding: input.encoding, delimiter: input.delimiter, has_header: input.hasHeader, physical_row_count: input.prevalidation.physicalRowCount, timezone: 'America/Sao_Paulo', sha256_over_original_bytes: true, algorithm_version: IMPORT_ALGORITHM_VERSION, batch_size: input.batchSize ?? DEFAULT_IMPORT_BATCH_SIZE, first_reading: input.prevalidation.firstReading, last_reading: input.prevalidation.lastReading, predominant_cadence_minutes: input.prevalidation.predominantCadenceMinutes }
  const insert = {
    id: importId, filename: safeName, original_filename: input.file.name, file_hash: input.hash,
    source_type: input.source.type, dmc_id: input.source.type === 'DMC' ? input.source.dmc.id : null,
    supply_group: input.source.type === 'SUPPLY_OUTLET' ? input.source.supplyGroup : null,
    imported_by: input.userId, row_count: input.prevalidation.sourceRowCount, status: 'PENDING',
    mapping_json: mappingJson, metadata_json: metadataJson, storage_path: storagePath,
    file_size_bytes: input.bytes.byteLength, file_extension: extension, mime_type: input.file.type || 'application/octet-stream',
  }
  const { error: createError } = await client().from('data_imports').insert(insert)
  if (createError) throw createError
  const fail = async (status: 'FAILED' | 'PARTIAL', message: string) => {
    await client().from('data_imports').update({ status, notes: message }).eq('id', importId)
    throw new Error(message)
  }
  const upload = await client().storage.from(HYDRAULIC_IMPORT_BUCKET).upload(storagePath, input.bytes, { contentType: insert.mime_type, upsert: false })
  if (upload.error) return fail('FAILED', `Falha ao preservar arquivo original: ${upload.error.message}`)
  const processing = await client().from('data_imports').update({ status: 'PROCESSING' }).eq('id', importId)
  if (processing.error) return fail('FAILED', processing.error.message)

  const size = input.batchSize ?? DEFAULT_IMPORT_BATCH_SIZE
  let processed = 0
  const measurementIds = new Map<string, string>()
  for (const batch of batches(input.prevalidation.measurements, size)) {
    if (input.signal?.aborted) return fail(processed > 0 ? 'PARTIAL' : 'FAILED', 'Processamento interrompido; RAW já confirmado foi preservado.')
    const payload = batch.map((item) => ({ import_id: importId, dmc_id: input.source.type === 'DMC' ? input.source.dmc.id : null, source_type: input.source.type, supply_group: input.source.type === 'SUPPLY_OUTLET' ? input.source.supplyGroup : null, channel_type: item.channelType, channel_name: item.channelName, measured_at: item.measuredAt, raw_value: item.rawValue, unit: item.unit, row_number: item.rowNumber, column_index: item.columnIndex, raw_payload: item.rawPayload }))
    const { data, error } = await client().from('raw_measurements').insert(payload).select('id,row_number,column_index')
    if (error) return fail(processed > 0 ? 'PARTIAL' : 'FAILED', `Falha no lote RAW: ${error.message}`)
    ;(data ?? []).forEach((row) => measurementIds.set(`${row.row_number}|${row.column_index}`, row.id))
    processed += batch.length
    input.onProgress?.(processed, input.prevalidation.measurements.length)
  }

  for (const batch of batches(input.prevalidation.rejectedRows, size)) {
    const { error } = await client().from('import_rejected_rows').insert(batch.map((row) => ({ import_id: importId, row_number: row.rowNumber, raw_payload: row.rawPayload, reason_code: row.reasonCode, details: row.details })))
    if (error) return fail('PARTIAL', `RAW preservado, mas houve falha ao registrar rejeições: ${error.message}`)
  }
  const flagRows = input.prevalidation.flags.map((flag: ObjectiveFlag) => ({ measurement_id: measurementIds.get(`${flag.rowNumber}|${flag.columnIndex}`), flag_type: flag.flagType, severity: flag.severity, detected_by: 'SYSTEM', algorithm_version: IMPORT_ALGORITHM_VERSION, details: flag.details })).filter((flag) => flag.measurement_id)
  for (const batch of batches(flagRows, size)) {
    const { error } = await client().from('measurement_quality_flags').insert(batch)
    if (error) return fail('PARTIAL', `RAW preservado, mas houve falha ao registrar flags: ${error.message}`)
  }
  const { data, error } = await client().from('data_imports').update({ status: 'COMPLETED', accepted_count: input.prevalidation.validTimestampCount, rejected_count: input.prevalidation.invalidTimestampCount }).eq('id', importId).select('*').single()
  if (error) return fail('PARTIAL', error.message)
  return data as DataImportRow
}

export async function resumeImport(item: DataImportRow, userId: string, onProgress?: (processed: number, total: number) => void, recoveryClient: SupabaseClient = client()): Promise<DataImportRow> {
  if (!['PROCESSING', 'PARTIAL'].includes(item.status)) throw new Error('Somente imports PROCESSING ou PARTIAL podem ser retomados.')
  if (!item.storage_path) throw new Error('Import sem objeto de Storage; retomada bloqueada.')
  if (item.imported_by !== userId) throw new Error('A retomada deve ser executada pelo usuário que iniciou o import.')

  let duplicateBuilder = recoveryClient.from('data_imports').select('id', { count: 'exact', head: true }).eq('file_hash', item.file_hash).eq('source_type', item.source_type)
  duplicateBuilder = item.source_type === 'DMC' ? duplicateBuilder.eq('dmc_id', item.dmc_id) : duplicateBuilder.eq('supply_group', item.supply_group)
  const duplicateQuery = await duplicateBuilder
  if (duplicateQuery.error) throw duplicateQuery.error
  if (duplicateQuery.count !== 1) throw new Error('Contexto duplicado ou ausente; retomada bloqueada.')

  const download = await recoveryClient.storage.from(HYDRAULIC_IMPORT_BUCKET).download(item.storage_path)
  if (download.error) throw new Error(`Falha ao ler arquivo original do Storage: ${download.error.message}`)
  const bytes = await download.data.arrayBuffer()
  if (await sha256Hex(bytes) !== item.file_hash) throw new Error('Hash do objeto de Storage diverge do import; retomada bloqueada.')

  const mappings = mappingsFromSnapshot(item.mapping_json)
  const metadata = metadataFromSnapshot(item.metadata_json)
  const parsed = prevalidateDelimitedText(decodeBytes(new Uint8Array(bytes), metadata.encoding), metadata.delimiter, metadata.encoding, metadata.headerMode, mappings)
  if (parsed.result.sourceRowCount !== item.row_count) throw new Error('Quantidade de linhas diverge do snapshot original; retomada bloqueada.')

  const run = await recoveryClient.from('import_processing_runs').insert({ import_id: item.id, status: 'PROCESSING', mapping_snapshot: item.mapping_json, metadata_snapshot: item.metadata_json, reason: 'Retomada idempotente de importação interrompida', initiated_by: userId, started_at: new Date().toISOString() }).select('id').single()
  if (run.error) throw run.error
  let processed = 0
  try {
    for (const batch of batches(parsed.result.measurements, DEFAULT_IMPORT_BATCH_SIZE)) {
      const rowNumbers = [...new Set(batch.map((measurement) => measurement.rowNumber))]
      const existing = await recoveryClient.from('raw_measurements').select('row_number,column_index').eq('import_id', item.id).in('row_number', rowNumbers)
      if (existing.error) throw existing.error
      const existingKeys = new Set((existing.data ?? []).map((row) => rawRecoveryKey(Number(row.row_number), Number(row.column_index))))
      const missing = missingMeasurements(batch, existingKeys)
      if (missing.length) {
        const payload = missing.map((measurement) => ({ import_id: item.id, dmc_id: item.dmc_id, source_type: item.source_type, supply_group: item.supply_group, channel_type: measurement.channelType, channel_name: measurement.channelName, measured_at: measurement.measuredAt, raw_value: measurement.rawValue, unit: measurement.unit, row_number: measurement.rowNumber, column_index: measurement.columnIndex, raw_payload: measurement.rawPayload }))
        const inserted = await recoveryClient.from('raw_measurements').insert(payload)
        if (inserted.error) throw inserted.error
      }
      processed += batch.length
      onProgress?.(processed, parsed.result.measurements.length)
    }

    for (const batch of batches(parsed.result.rejectedRows, DEFAULT_IMPORT_BATCH_SIZE)) {
      const rejected = await recoveryClient.from('import_rejected_rows').upsert(batch.map((row) => ({ import_id: item.id, row_number: row.rowNumber, raw_payload: row.rawPayload, reason_code: row.reasonCode, details: row.details })), { onConflict: 'import_id,row_number,reason_code', ignoreDuplicates: true })
      if (rejected.error) throw rejected.error
    }

    for (const batch of batches(parsed.result.flags, DEFAULT_IMPORT_BATCH_SIZE)) {
      const ids = new Map<string, string>()
      for (const [columnIndex, columnFlags] of groupFlagsByColumn(batch)) {
        const rowNumbers = [...new Set(columnFlags.map((flag) => flag.rowNumber))]
        const measurements = await recoveryClient.from('raw_measurements').select('id,row_number,column_index').eq('import_id', item.id).eq('column_index', columnIndex).in('row_number', rowNumbers)
        if (measurements.error) throw measurements.error
        ;(measurements.data ?? []).forEach((row) => ids.set(rawRecoveryKey(Number(row.row_number), Number(row.column_index)), String(row.id)))
      }
      const candidates = batch.map((flag) => ({ measurementId: ids.get(rawRecoveryKey(flag.rowNumber, flag.columnIndex)), flagType: flag.flagType, algorithmVersion: IMPORT_ALGORITHM_VERSION, severity: flag.severity, details: flag.details })).filter((flag): flag is typeof flag & { measurementId: string } => Boolean(flag.measurementId))
      if (candidates.length !== batch.length) throw new Error('Medição RAW ausente durante geração de flags; retomada interrompida.')
      const existing = await recoveryClient.from('measurement_quality_flags').select('measurement_id,flag_type,algorithm_version').in('measurement_id', candidates.map((flag) => flag.measurementId)).eq('algorithm_version', IMPORT_ALGORITHM_VERSION)
      if (existing.error) throw existing.error
      const existingKeys = new Set((existing.data ?? []).map((flag) => flagRecoveryKey(String(flag.measurement_id), flag.flag_type as ObjectiveFlag['flagType'], String(flag.algorithm_version))))
      const missing = missingFlags(candidates, existingKeys)
      if (missing.length) {
        const inserted = await recoveryClient.from('measurement_quality_flags').upsert(missing.map((flag) => ({ measurement_id: flag.measurementId, flag_type: flag.flagType, severity: flag.severity, detected_by: 'SYSTEM', algorithm_version: flag.algorithmVersion, details: flag.details })), { onConflict: 'measurement_id,flag_type,algorithm_version', ignoreDuplicates: true })
        if (inserted.error) throw inserted.error
      }
    }

    for (const mapping of mappings.filter((mapping) => !['IGNORE', 'TIMESTAMP'].includes(mapping.channelType))) {
      const expected = parsed.result.measurements.filter((measurement) => measurement.columnIndex === mapping.index).length
      const persisted = await recoveryClient.from('raw_measurements').select('id', { count: 'exact', head: true }).eq('import_id', item.id).eq('column_index', mapping.index)
      if (persisted.error) throw persisted.error
      if (persisted.count !== expected) throw new Error(`Contagem RAW divergente em ${mapping.channelType}: esperado ${expected}, persistido ${persisted.count ?? 0}.`)
    }

    const completed = await recoveryClient.from('data_imports').update({ status: 'COMPLETED', accepted_count: parsed.result.validTimestampCount, rejected_count: parsed.result.invalidTimestampCount, notes: 'Retomada idempotente concluída com validação integral.' }).eq('id', item.id).in('status', ['PROCESSING', 'PARTIAL']).select('*').single()
    if (completed.error) throw completed.error
    const finishedRun = await recoveryClient.from('import_processing_runs').update({ status: 'COMPLETED', finished_at: new Date().toISOString() }).eq('id', run.data.id)
    if (finishedRun.error) throw finishedRun.error
    return completed.data as DataImportRow
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Retomada interrompida.'
    await recoveryClient.from('data_imports').update({ status: 'PARTIAL', notes: message }).eq('id', item.id).in('status', ['PROCESSING', 'PARTIAL'])
    await recoveryClient.from('import_processing_runs').update({ status: 'PARTIAL', finished_at: new Date().toISOString() }).eq('id', run.data.id)
    throw caught
  }
}

export async function requestReprocessing(item: DataImportRow, userId: string, reason = 'Reprocessamento solicitado pela interface'): Promise<void> {
  const { error } = await client().from('import_processing_runs').insert({ import_id: item.id, status: 'PENDING', mapping_snapshot: item.mapping_json, metadata_snapshot: item.metadata_json, reason, initiated_by: userId })
  if (error) throw error
}
