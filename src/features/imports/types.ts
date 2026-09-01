import type { DmcRow, SupplyGroup } from '../../types/database.types'

export type FileEncoding = 'UTF-8' | 'WINDOWS-1252'
export type Delimiter = ';' | ',' | '\t'
export type ImportSource = { type: 'DMC'; dmc: DmcRow } | { type: 'SUPPLY_OUTLET'; supplyGroup: SupplyGroup }
export type ImportChannel = 'IGNORE' | 'TIMESTAMP' | 'PRESSURE_PC' | 'PRESSURE_UPSTREAM' | 'PRESSURE_DOWNSTREAM' | 'PRESSURE_SUPPLY' | 'FLOW' | 'OTHER'
export type RawChannel = Exclude<ImportChannel, 'IGNORE' | 'TIMESTAMP'>

export interface ColumnMapping {
  index: number
  headerOriginal: string
  headerNormalized: string
  channelType: ImportChannel
  unit: string | null
  confidence: 'HIGH' | 'MEDIUM' | 'NONE'
}

export interface ParsedTable {
  headers: string[]
  rows: unknown[][]
  encoding: FileEncoding | 'XLSX'
  delimiter: Delimiter | null
}

export interface PreparedMeasurement {
  rowNumber: number
  columnIndex: number
  channelType: RawChannel
  channelName: string
  measuredAt: string
  rawValue: number | null
  unit: string
  rawPayload: Record<string, unknown>
}

export interface RejectedRow {
  rowNumber: number
  rawPayload: Record<string, unknown>
  reasonCode: 'INVALID_TIMESTAMP' | 'STRUCTURAL_ERROR'
  details: Record<string, unknown>
}

export interface ObjectiveFlag {
  rowNumber: number
  columnIndex: number
  flagType: 'MISSING_TIMESTAMP' | 'DUPLICATE' | 'NULL_VALUE' | 'ZERO_STREAK'
  severity: 'INFO' | 'WARNING'
  details: Record<string, unknown>
}

export interface PrevalidationResult {
  measurements: PreparedMeasurement[]
  rejectedRows: RejectedRow[]
  flags: ObjectiveFlag[]
  sourceRowCount: number
  validTimestampCount: number
  invalidTimestampCount: number
  mappedChannelCount: number
  validNumericCount: number
  nullValueCount: number
  numericParseErrorCount: number
  duplicateCount: number
  predominantCadenceMinutes: number | null
  gapCount: number
  largestGapMinutes: number | null
  firstReading: string | null
  lastReading: string | null
}
