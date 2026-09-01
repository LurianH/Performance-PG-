/** Tipos manuais alinhados às migrations locais da ETAPA 2.
 * Substituir por `supabase gen types` somente após existir ambiente autorizado. */
export type AppRole = 'ADMIN' | 'GESTOR' | 'LEITURA'
export type SupplyGroup = 'REDE' | 'XIXOVA'
export type EquipmentStatus =
  | 'NOT_INSTALLED'
  | 'INSTALLED_NOT_COMMISSIONED'
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'FAILED'
  | 'MAINTENANCE'

export interface ProfileRow {
  id: string
  email: string
  full_name: string | null
  role: AppRole
  active: boolean
  created_at: string
  updated_at: string
}

export interface DmcRow {
  id: string
  code: string | null
  name: string
  supply_group: SupplyGroup
  pc_channel: string | null
  has_vrp: boolean
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ValidatedMeasurementRow {
  measurement_id: string
  measured_at: string
  dmc_id: string | null
  source_type: 'DMC' | 'SUPPLY_OUTLET'
  supply_group: SupplyGroup | null
  channel_type: string
  invalid_reason: string | null
  equipment_status: EquipmentStatus | null
  has_quality_flag: boolean
  is_excluded: boolean
  raw_value: number | null
  normalized_value: number | null
  raw_unit: string
  normalized_unit: string
  is_valid: boolean
  quality_status: string
  exclusion_reason: string | null
  import_id: string
}

export interface EquipmentPeriodChannelRow {
  id: string
  equipment_period_id: string
  channel_type: string
  notes: string | null
  created_at: string
}

export interface PerformanceContractParameterRow {
  id: string
  parameter_key: string
  numeric_value: number | null
  text_value: string | null
  effective_from: string
  effective_to: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface TechnicalParameterRow {
  id: string
  key: string
  numeric_value: number | null
  text_value: string | null
  json_value: unknown | null
  effective_from: string
  effective_to: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface ReferenceCounts {
  imports: number
  raw: number
  exclusions: number
  flags: number
  rejectedRows: number
  gaps: number
  duplicates: number
  performanceMonths: number
  projectionScenarios: number
  equipmentPeriods: number
}

export interface DmcCoverage {
  id: string
  name: string
  rawCount: number
}

export interface DataImportRow {
  id: string
  filename: string
  original_filename: string
  file_hash: string
  source_type: 'DMC' | 'SUPPLY_OUTLET'
  dmc_id: string | null
  supply_group: SupplyGroup | null
  imported_by: string | null
  imported_at: string
  row_count: number
  accepted_count: number
  rejected_count: number
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIAL'
  mapping_json: unknown
  metadata_json: unknown
  storage_path: string | null
  file_size_bytes: number | null
  file_extension: string | null
  mime_type: string | null
}
