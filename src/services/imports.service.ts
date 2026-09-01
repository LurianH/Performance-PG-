import { supabase } from '../lib/supabase'
import type { DataImportRow, ImportChannelOperationalSummary, ImportOperationalSummary } from '../types/database.types'
import { IMPORT_ALGORITHM_VERSION, serializeMappings } from '../features/imports/parser'
import { calculateCoverage, readImportChannels, readImportDescriptor, summarizeFlags, type ImportFlagRecord } from '../features/imports/operational-summary'
import type { ColumnMapping, ImportSource, ObjectiveFlag, PrevalidationResult } from '../features/imports/types'

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
  const channels = await Promise.all(descriptors.map(async (channel): Promise<ImportChannelOperationalSummary> => {
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
    return { ...channel, rawCount, minimum: minimumResult.data?.raw_value == null ? null : Number(minimumResult.data.raw_value), maximum: maximumResult.data?.raw_value == null ? null : Number(maximumResult.data.raw_value), flags: quality.total, flagBreakdown: quality.breakdown, gaps: quality.gaps, missingTimestamps: quality.missingTimestamps, coveragePercent: calculateCoverage(descriptor.firstReading, descriptor.lastReading, descriptor.cadenceMinutes, rawCount) }
  }))
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
  return Promise.all((await listImports()).map(getImportSummary))
}

function batches<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
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

export async function requestReprocessing(item: DataImportRow, userId: string, reason = 'Reprocessamento solicitado pela interface'): Promise<void> {
  const { error } = await client().from('import_processing_runs').insert({ import_id: item.id, status: 'PENDING', mapping_snapshot: item.mapping_json, metadata_snapshot: item.metadata_json, reason, initiated_by: userId })
  if (error) throw error
}
