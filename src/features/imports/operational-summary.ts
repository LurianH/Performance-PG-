import { normalizeMeasurement } from '../hydraulics/domain-rules'
import type { DataImportRow, ImportOperationalSummary, ImportQualityBreakdown } from '../../types/database.types'
import type { ColumnMapping, PrevalidationResult } from './types'

export type ImportFlagRecord = {
  flag_type: string
  severity: string
  details: Record<string, unknown> | null
}

export function formatImportDecimal(value: number | null, maximumFractionDigits = 8): string {
  return value === null ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits })
}

export function summarizePrevalidationChannels(result: PrevalidationResult, mappings: ColumnMapping[]) {
  return mappings.filter((mapping) => !['IGNORE', 'TIMESTAMP'].includes(mapping.channelType)).map((mapping) => {
    const measurements = result.measurements.filter((measurement) => measurement.columnIndex === mapping.index)
    const numeric = measurements.map((measurement) => measurement.rawValue).filter((value): value is number => value !== null)
    const flags = result.flags.filter((flag) => flag.columnIndex === mapping.index)
    const quality = summarizeFlags(flags.map((flag) => ({ flag_type: flag.flagType, severity: flag.severity, details: flag.details })))
    return {
      mapping,
      rawCount: measurements.length,
      minimum: numeric.length ? numeric.reduce((minimum, value) => Math.min(minimum, value), numeric[0]) : null,
      maximum: numeric.length ? numeric.reduce((maximum, value) => Math.max(maximum, value), numeric[0]) : null,
      quality,
      coverage: calculateCoverage(result.firstReading, result.lastReading, result.predominantCadenceMinutes, measurements.length),
    }
  })
}

export function readImportDescriptor(item: DataImportRow) {
  const metadata = (item.metadata_json ?? {}) as Record<string, unknown>
  const mappings = Array.isArray(item.mapping_json) ? item.mapping_json as Array<Record<string, unknown>> : []
  const channel = mappings.find((entry) => entry.channel_type === 'PRESSURE_SUPPLY' || entry.channel_type === 'FLOW')
  const channelType = channel?.channel_type === 'PRESSURE_SUPPLY' || channel?.channel_type === 'FLOW' ? channel.channel_type : '—'
  const rawUnit = typeof channel?.unit === 'string' ? channel.unit : '—'
  return {
    channelType,
    rawUnit,
    normalizedUnit: normalizeMeasurement(null, channelType, rawUnit).unit,
    firstReading: typeof metadata.first_reading === 'string' ? metadata.first_reading : null,
    lastReading: typeof metadata.last_reading === 'string' ? metadata.last_reading : null,
    cadenceMinutes: typeof metadata.predominant_cadence_minutes === 'number' ? metadata.predominant_cadence_minutes : null,
  } as const
}

export function readImportChannels(item: DataImportRow) {
  const mappings = Array.isArray(item.mapping_json) ? item.mapping_json as Array<Record<string, unknown>> : []
  return mappings.filter((entry) => !['TIMESTAMP', 'IGNORE'].includes(String(entry.channel_type))).map((entry) => {
    const channelType = String(entry.channel_type ?? '—')
    const rawUnit = typeof entry.unit === 'string' ? entry.unit : '—'
    return { channelType, rawUnit, normalizedUnit: normalizeMeasurement(null, channelType, rawUnit).unit }
  })
}

export function summarizeImportSnapshot(item: DataImportRow): ImportOperationalSummary {
  const descriptor = readImportDescriptor(item)
  const channels = readImportChannels(item).map((channel) => ({
    ...channel,
    rawCount: item.accepted_count,
    minimum: null,
    maximum: null,
    flags: 0,
    flagBreakdown: [],
    gaps: 0,
    missingTimestamps: 0,
    coveragePercent: calculateCoverage(descriptor.firstReading, descriptor.lastReading, descriptor.cadenceMinutes, item.accepted_count),
  }))
  const coverage = channels.map((channel) => channel.coveragePercent).filter((value): value is number => value !== null)
  return {
    import: item,
    firstReading: descriptor.firstReading,
    lastReading: descriptor.lastReading,
    rawCount: channels.reduce((total, channel) => total + channel.rawCount, 0),
    flags: 0,
    flagBreakdown: [],
    gaps: 0,
    missingTimestamps: 0,
    coveragePercent: coverage.length ? coverage.reduce((total, value) => total + value, 0) / coverage.length : null,
    rejections: item.rejected_count,
    channels,
  }
}

export function calculateCoverage(firstReading: string | null, lastReading: string | null, cadenceMinutes: number | null, rawCount: number): number | null {
  if (!firstReading || !lastReading || !cadenceMinutes || cadenceMinutes <= 0) return null
  const elapsedMinutes = (Date.parse(lastReading) - Date.parse(firstReading)) / 60_000
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes < 0) return null
  const expected = Math.round(elapsedMinutes / cadenceMinutes) + 1
  return expected > 0 ? Math.min(100, rawCount / expected * 100) : null
}

export function summarizeFlags(rows: ImportFlagRecord[]): { total: number; breakdown: ImportQualityBreakdown[]; gaps: number; missingTimestamps: number } {
  const grouped = new Map<string, ImportQualityBreakdown>()
  let gaps = 0
  let missingTimestamps = 0
  rows.forEach((row) => {
    const key = `${row.flag_type}|${row.severity}`
    const current = grouped.get(key)
    grouped.set(key, { type: row.flag_type, severity: row.severity, count: (current?.count ?? 0) + 1 })
    if (row.flag_type === 'MISSING_TIMESTAMP') {
      gaps += 1
      const missing = Number(row.details?.missingCount ?? 0)
      if (Number.isFinite(missing) && missing > 0) missingTimestamps += missing
    }
  })
  return { total: rows.length, breakdown: [...grouped.values()].sort((a, b) => a.type.localeCompare(b.type)), gaps, missingTimestamps }
}
