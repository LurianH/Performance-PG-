import type { EquipmentStatus } from '../../types/database.types'

export type PcClassification = 'NO_DATA' | 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERPRESSURE'

export function classifyPcPressure(valueMca: number | null): PcClassification {
  if (valueMca === null) return 'NO_DATA'
  if (valueMca > 50) return 'OVERPRESSURE'
  if (valueMca < 3.2) return 'CRITICAL'
  if (valueMca < 10) return 'LOW'
  return 'NORMAL'
}

export function litersPerSecondToCubicMetersPerHour(value: number | null): number | null {
  return value === null ? null : value * 3.6
}

export function cubicMetersPerHourToLitersPerSecond(value: number | null): number | null {
  return value === null ? null : value / 3.6
}

export function isEquipmentAvailable(status: EquipmentStatus): boolean {
  return status === 'AVAILABLE'
}

export function canUseMeasurementForHydraulics(value: number | null, status: EquipmentStatus): boolean {
  return value !== null && isEquipmentAvailable(status)
}

export interface EquipmentChannelImpact {
  channelType: string
  status: EquipmentStatus
}

export interface MeasurementEligibilityInput {
  rawValue: number | null
  channelType: string
  equipmentImpacts: EquipmentChannelImpact[]
  hasInvalidQualityFlag?: boolean
  exclusionActive?: boolean
}

export function evaluateMeasurementEligibility(input: MeasurementEligibilityInput) {
  const equipmentImpact = input.equipmentImpacts.find((impact) => impact.channelType === input.channelType)
  const equipmentInvalid = equipmentImpact ? !isEquipmentAvailable(equipmentImpact.status) : false
  const isValid = input.rawValue !== null
    && !equipmentInvalid
    && !input.hasInvalidQualityFlag
    && !input.exclusionActive

  return {
    rawValue: input.rawValue,
    isValid,
    equipmentStatus: equipmentImpact?.status ?? null,
  }
}
