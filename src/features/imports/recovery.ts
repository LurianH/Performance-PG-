import type { ObjectiveFlag, PreparedMeasurement } from './types'

export const rawRecoveryKey = (rowNumber: number, columnIndex: number) => `${rowNumber}|${columnIndex}`
export const flagRecoveryKey = (measurementId: string, flagType: ObjectiveFlag['flagType'], algorithmVersion: string) => `${measurementId}|${flagType}|${algorithmVersion}`

export function missingMeasurements(measurements: PreparedMeasurement[], existingKeys: ReadonlySet<string>): PreparedMeasurement[] {
  return measurements.filter((measurement) => !existingKeys.has(rawRecoveryKey(measurement.rowNumber, measurement.columnIndex)))
}

export function missingFlags<T extends { measurementId: string; flagType: ObjectiveFlag['flagType']; algorithmVersion: string }>(flags: T[], existingKeys: ReadonlySet<string>): T[] {
  return flags.filter((flag) => !existingKeys.has(flagRecoveryKey(flag.measurementId, flag.flagType, flag.algorithmVersion)))
}

export function recoveryBatches<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}

export function groupFlagsByColumn<T extends { columnIndex: number }>(flags: T[]): Map<number, T[]> {
  const grouped = new Map<number, T[]>()
  flags.forEach((flag) => grouped.set(flag.columnIndex, [...(grouped.get(flag.columnIndex) ?? []), flag]))
  return grouped
}
