import type { AppRole, EquipmentStatus, SupplyGroup } from './database.types'

export interface AuthViewModel {
  id: string
  email: string
  fullName: string | null
  role: AppRole
  active: boolean
}

export interface TechnicalParameterMockViewModel {
  key: string
  label: string
  value: string
  unit?: string
  category: 'PRESSURE' | 'WINDOW' | 'IAL' | 'IPS'
}

export interface EquipmentPeriodMockViewModel {
  dmc: string
  supply: SupplyGroup
  equipment: string
  status: EquipmentStatus
  period: string
}
