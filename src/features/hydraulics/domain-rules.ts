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

export interface NormalizedMeasurement {
  value: number | null
  unit: 'l_s' | 'mca' | null
}

/** Espelha a regra canônica da view validated_measurements sem modificar o RAW. */
export function normalizeMeasurement(
  rawValue: number | null,
  channelType: string,
  rawUnit: string,
): NormalizedMeasurement {
  if (rawValue === null) {
    const supportedUnit = channelType === 'FLOW' && ['m3/h', 'm3_h', 'm3h', 'l/s', 'l_s', 'ls'].includes(rawUnit.toLowerCase())
      ? 'l_s'
      : channelType.startsWith('PRESSURE_') && rawUnit.toLowerCase() === 'mca'
        ? 'mca'
        : null
    return { value: null, unit: supportedUnit }
  }
  const unit = rawUnit.toLowerCase()
  if (channelType === 'FLOW' && ['m3/h', 'm3_h', 'm3h'].includes(unit)) {
    return { value: cubicMetersPerHourToLitersPerSecond(rawValue), unit: 'l_s' }
  }
  if (channelType === 'FLOW' && ['l/s', 'l_s', 'ls'].includes(unit)) {
    return { value: rawValue, unit: 'l_s' }
  }
  if (channelType.startsWith('PRESSURE_') && unit === 'mca') {
    return { value: rawValue, unit: 'mca' }
  }
  return { value: null, unit: null }
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
