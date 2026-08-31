/** Tipos manuais alinhados às migrations locais da ETAPA 2.
 * Substituir por `supabase gen types` somente após existir ambiente autorizado. */
export type AppRole = 'ADMIN' | 'GESTOR' | 'LEITURA'
export type SupplyGroup = 'REDE' | 'XIXOVA'
export type EquipmentStatus =
  | 'INSTALLED'
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'FAILED'
  | 'NOT_INSTALLED'
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
  raw_value: number | null
  normalized_value: number | null
  raw_unit: string
  normalized_unit: string
  is_valid: boolean
  quality_status: string
  exclusion_reason: string | null
  import_id: string
}
