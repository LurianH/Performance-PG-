import type { ColumnMapping, Delimiter, FileEncoding, HeaderMode, ObjectiveFlag, ParsedTable, PrevalidationResult, PreparedMeasurement, RejectedRow } from './types'

export const IMPORT_TIMEZONE = 'America/Sao_Paulo'
export const IMPORT_ALGORITHM_VERSION = 'raw-import-v1'

export function importContextKey(hash: string, sourceType: 'DMC' | 'SUPPLY_OUTLET', scopeId: string): string {
  return `${hash}|${sourceType}|${scopeId}`
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}

export function detectEncoding(bytes: Uint8Array): FileEncoding {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'UTF-8'
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return 'UTF-8'
  } catch {
    return 'WINDOWS-1252'
  }
}

export function decodeBytes(bytes: Uint8Array, encoding: FileEncoding): string {
  return new TextDecoder(encoding === 'UTF-8' ? 'utf-8' : 'windows-1252').decode(bytes)
}

export function detectDelimiter(text: string): Delimiter {
  const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 10)
  const candidates: Delimiter[] = [';', ',', '\t']
  return candidates.map((delimiter) => ({ delimiter, score: lines.reduce((total, line) => total + splitDelimitedLine(line, delimiter).length, 0) })).sort((a, b) => b.score - a.score)[0].delimiter
}

function splitDelimitedLine(line: string, delimiter: Delimiter): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1 } else quoted = !quoted
    } else if (character === delimiter && !quoted) { cells.push(current); current = '' } else current += character
  }
  cells.push(current)
  return cells
}

function cellKind(value: unknown): 'TIMESTAMP' | 'NUMBER' | 'EMPTY' | 'TEXT' {
  if (value === null || value === undefined || String(value).trim() === '') return 'EMPTY'
  if (parseLocalTimestamp(value)) return 'TIMESTAMP'
  if (parseLocaleNumber(value) !== undefined) return 'NUMBER'
  return 'TEXT'
}

export function detectHeaderMode(matrix: unknown[][]): { suggestedMode: Exclude<HeaderMode, 'AUTO'> | null; confidence: 'HIGH' | 'LOW' } {
  if (matrix.length < 2 || matrix[0].length === 0) return { suggestedMode: null, confidence: 'LOW' }
  const first = matrix[0].map(cellKind)
  const following = matrix.slice(1, 6).filter((row) => row.length === first.length).map((row) => row.map(cellKind))
  if (following.length === 0) return { suggestedMode: null, confidence: 'LOW' }
  const compatible = following.filter((kinds) => kinds.every((kind, index) => kind === first[index])).length
  const firstLooksLikeData = first.some((kind) => kind === 'TIMESTAMP') && first.some((kind) => kind === 'NUMBER')
  if (firstLooksLikeData && compatible >= Math.min(2, following.length)) return { suggestedMode: 'ABSENT', confidence: 'HIGH' }
  const followingLooksLikeData = following.filter((kinds) => kinds.some((kind) => kind === 'TIMESTAMP') && kinds.some((kind) => kind === 'NUMBER')).length
  if (first.some((kind) => kind === 'TEXT') && followingLooksLikeData >= Math.min(2, following.length)) return { suggestedMode: 'PRESENT', confidence: 'HIGH' }
  return { suggestedMode: null, confidence: 'LOW' }
}

function buildParsedTable(matrix: unknown[][], encoding: FileEncoding | 'XLSX', delimiter: Delimiter | null, headerMode: HeaderMode): ParsedTable {
  const detection = detectHeaderMode(matrix)
  const hasHeader = headerMode === 'PRESENT' ? true : headerMode === 'ABSENT' ? false : detection.suggestedMode === 'PRESENT' ? true : detection.suggestedMode === 'ABSENT' ? false : null
  const width = Math.max(0, ...matrix.map((row) => row.length))
  const headers = hasHeader ? (matrix[0] ?? []).map(String) : Array.from({ length: width }, (_, index) => `Coluna ${index + 1}`)
  const rows = hasHeader === true ? matrix.slice(1) : matrix
  return { headers, rows, encoding, delimiter, hasHeader, physicalRowCount: matrix.length, suggestedHeaderMode: detection.suggestedMode, headerConfidence: detection.confidence }
}

export function parseDelimitedText(text: string, delimiter = detectDelimiter(text), encoding: FileEncoding = 'UTF-8', headerMode: HeaderMode = 'PRESENT'): ParsedTable {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0)
  const matrix = lines.map((line) => splitDelimitedLine(line, delimiter))
  return buildParsedTable(matrix, encoding, delimiter, headerMode)
}

export async function parseXlsxFile(file: Blob, headerMode: HeaderMode = 'PRESENT'): Promise<ParsedTable> {
  const { readSheet } = await import('read-excel-file/browser')
  const rows = await readSheet(file)
  return buildParsedTable(rows, 'XLSX', null, headerMode)
}

export function parseLocaleNumber(input: unknown): number | null | undefined {
  if (input === null || input === undefined || String(input).trim() === '') return null
  if (typeof input === 'number') return Number.isFinite(input) ? input : undefined
  const value = String(input).trim().replace(/\s/g, '')
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(value)) return undefined
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

function localPartsToIso(year: number, month: number, day: number, hour: number, minute: number, second: number): string | null {
  const candidate = new Date(`${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}-03:00`)
  if (Number.isNaN(candidate.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: IMPORT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(candidate)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  return get('year') === year && get('month') === month && get('day') === day && get('hour') === hour && get('minute') === minute && get('second') === second ? candidate.toISOString() : null
}

export function parseLocalTimestamp(input: unknown): string | null {
  if (input instanceof Date) return localPartsToIso(input.getUTCFullYear(), input.getUTCMonth() + 1, input.getUTCDate(), input.getUTCHours(), input.getUTCMinutes(), input.getUTCSeconds())
  const match = String(input ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null
  return localPartsToIso(Number(match[3]), Number(match[2]), Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6] ?? 0))
}

export function normalizeHeader(header: string): string {
  return header.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/³/g, '3').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function suggestMapping(headers: string[], pcChannel?: string | null, genericPressureChannel: 'PRESSURE_PC' | 'PRESSURE_SUPPLY' = 'PRESSURE_PC', hasHeader = true): ColumnMapping[] {
  const pc = pcChannel ? normalizeHeader(pcChannel) : null
  return headers.map((headerOriginal, index) => {
    const headerNormalized = normalizeHeader(headerOriginal)
    let channelType: ColumnMapping['channelType'] = 'IGNORE'
    let unit: string | null = null
    let confidence: ColumnMapping['confidence'] = 'NONE'
    if (/data.*hora|timestamp/.test(headerNormalized)) { channelType = 'TIMESTAMP'; confidence = 'HIGH' }
    else if (pc && headerNormalized === pc) { channelType = 'PRESSURE_PC'; unit = 'mca'; confidence = 'HIGH' }
    else if (/pressao.*montante/.test(headerNormalized)) { channelType = 'PRESSURE_UPSTREAM'; unit = 'mca'; confidence = 'MEDIUM' }
    else if (/pressao.*jusante/.test(headerNormalized)) { channelType = 'PRESSURE_DOWNSTREAM'; unit = 'mca'; confidence = 'MEDIUM' }
    else if (/pressao/.test(headerNormalized)) { channelType = genericPressureChannel; unit = 'mca'; confidence = 'MEDIUM' }
    else if (/vazao/.test(headerNormalized)) { channelType = 'FLOW'; unit = /l\s?s|l s/.test(headerNormalized) ? 'l_s' : 'm3_h'; confidence = 'MEDIUM' }
    return { index, headerOriginal: hasHeader ? headerOriginal : null, displayName: headerOriginal, headerNormalized, channelType, unit, confidence }
  })
}

export function serializeMappings(mappings: ColumnMapping[], hasHeader: boolean): Record<string, unknown>[] {
  return mappings.map((mapping) => ({ has_header: hasHeader, column_index: mapping.index, header_original: mapping.headerOriginal, display_name: mapping.displayName, channel_type: mapping.channelType, unit: mapping.unit }))
}

function payload(headers: string[], row: unknown[]): Record<string, unknown> {
  return Object.fromEntries(headers.map((header, index) => [`${index}:${header}`, row[index] ?? null]))
}

export function prevalidate(table: ParsedTable, mappings: ColumnMapping[], zeroStreakSize = 4): PrevalidationResult {
  const timestamp = mappings.find((mapping) => mapping.channelType === 'TIMESTAMP')
  const channels = mappings.filter((mapping) => !['IGNORE', 'TIMESTAMP'].includes(mapping.channelType))
  const measurements: PreparedMeasurement[] = []
  const rejectedRows: RejectedRow[] = []
  const flags: ObjectiveFlag[] = []
  let validNumericCount = 0, nullValueCount = 0, numericParseErrorCount = 0
  const timestampValues: number[] = []
  const seen = new Map<string, PreparedMeasurement>()
  const zeroRuns = new Map<number, PreparedMeasurement[]>()

  table.rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + (table.hasHeader ? 2 : 1)
    const rawPayload = payload(table.headers, row)
    const measuredAt = timestamp ? parseLocalTimestamp(row[timestamp.index]) : null
    if (!measuredAt) { rejectedRows.push({ rowNumber, rawPayload, reasonCode: 'INVALID_TIMESTAMP', details: { original: timestamp ? row[timestamp.index] ?? null : null } }); return }
    timestampValues.push(Date.parse(measuredAt))
    channels.forEach((mapping) => {
      const parsed = parseLocaleNumber(row[mapping.index])
      if (parsed === undefined) numericParseErrorCount += 1
      else if (parsed === null) nullValueCount += 1
      else validNumericCount += 1
      const measurement: PreparedMeasurement = { rowNumber, columnIndex: mapping.index, channelType: mapping.channelType as PreparedMeasurement['channelType'], channelName: mapping.displayName, measuredAt, rawValue: parsed ?? null, unit: mapping.unit ?? 'raw', rawPayload }
      measurements.push(measurement)
      if (parsed === null || parsed === undefined) flags.push({ rowNumber, columnIndex: mapping.index, flagType: 'NULL_VALUE', severity: 'WARNING', details: { parseError: parsed === undefined, original: row[mapping.index] ?? null } })
      const duplicateKey = `${mapping.index}|${measuredAt}`
      if (seen.has(duplicateKey)) flags.push({ rowNumber, columnIndex: mapping.index, flagType: 'DUPLICATE', severity: 'WARNING', details: { firstRow: seen.get(duplicateKey)?.rowNumber, conflictingValue: seen.get(duplicateKey)?.rawValue !== measurement.rawValue } })
      else seen.set(duplicateKey, measurement)
      const run = zeroRuns.get(mapping.index) ?? []
      if (parsed === 0) { run.push(measurement); zeroRuns.set(mapping.index, run) } else { if (run.length >= zeroStreakSize) flags.push({ rowNumber: run[run.length - 1].rowNumber, columnIndex: mapping.index, flagType: 'ZERO_STREAK', severity: 'WARNING', details: { length: run.length, reviewOnly: true } }); zeroRuns.set(mapping.index, []) }
    })
  })
  zeroRuns.forEach((run, columnIndex) => { if (run.length >= zeroStreakSize) flags.push({ rowNumber: run[run.length - 1].rowNumber, columnIndex, flagType: 'ZERO_STREAK', severity: 'WARNING', details: { length: run.length, reviewOnly: true } }) })
  const sorted = [...new Set(timestampValues)].sort((a, b) => a - b)
  const deltas = sorted.slice(1).map((value, index) => Math.round((value - sorted[index]) / 60000)).filter((value) => value > 0)
  const frequencies = new Map<number, number>(); deltas.forEach((delta) => frequencies.set(delta, (frequencies.get(delta) ?? 0) + 1))
  const cadence = [...frequencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const gaps = cadence ? deltas.map((delta, index) => ({ delta, index })).filter(({ delta }) => delta > cadence) : []
  gaps.forEach(({ delta, index }) => {
    const firstTimestampAfterGap = sorted[index + 1]
    channels.forEach((mapping) => {
      const firstAfter = measurements.find((item) => item.columnIndex === mapping.index && Date.parse(item.measuredAt) === firstTimestampAfterGap)
      if (firstAfter) flags.push({ rowNumber: firstAfter.rowNumber, columnIndex: firstAfter.columnIndex, flagType: 'MISSING_TIMESTAMP', severity: 'WARNING', details: { gapStart: new Date(sorted[index]).toISOString(), gapEnd: new Date(firstTimestampAfterGap).toISOString(), expectedIntervalMinutes: cadence, missingCount: Math.max(0, Math.round(delta / cadence!) - 1) } })
    })
  })
  return { measurements, rejectedRows, flags, sourceRowCount: table.rows.length, physicalRowCount: table.physicalRowCount, validTimestampCount: table.rows.length - rejectedRows.length, invalidTimestampCount: rejectedRows.length, mappedChannelCount: channels.length, validNumericCount, nullValueCount, numericParseErrorCount, duplicateCount: flags.filter((flag) => flag.flagType === 'DUPLICATE').length, predominantCadenceMinutes: cadence, gapCount: gaps.length, largestGapMinutes: gaps.length ? Math.max(...gaps.map((gap) => gap.delta)) : null, firstReading: sorted.length ? new Date(sorted[0]).toISOString() : null, lastReading: sorted.length ? new Date(sorted[sorted.length - 1]).toISOString() : null }
}
