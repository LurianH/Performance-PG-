import { describe, expect, it } from 'vitest'
import { flagRecoveryKey, groupFlagsByColumn, missingFlags, missingMeasurements, rawRecoveryKey, recoveryBatches } from './recovery'
import type { PreparedMeasurement } from './types'

const channels = ['PRESSURE_PC', 'PRESSURE_UPSTREAM', 'PRESSURE_DOWNSTREAM', 'FLOW'] as const
const measurements = Array.from({ length: 5 }, (_, row) => channels.map((channel, column) => ({
  rowNumber: row + 1,
  columnIndex: column + 1,
  channelType: channel,
  channelName: channel,
  measuredAt: `2025-11-01T0${row}:00:00.000Z`,
  rawValue: row + column,
  unit: channel === 'FLOW' ? 'm3_h' : 'mca',
  rawPayload: {},
} satisfies PreparedMeasurement))).flat()

describe('retomada idempotente de importação', () => {
  it('retoma DMC de quatro canais após interrupções repetidas sem duplicar RAW', () => {
    const persisted = new Set(measurements.slice(0, 6).map((item) => rawRecoveryKey(item.rowNumber, item.columnIndex)))
    const firstResume = missingMeasurements(measurements, persisted)
    firstResume.slice(0, 5).forEach((item) => persisted.add(rawRecoveryKey(item.rowNumber, item.columnIndex)))
    const secondResume = missingMeasurements(measurements, persisted)
    secondResume.forEach((item) => persisted.add(rawRecoveryKey(item.rowNumber, item.columnIndex)))
    expect(persisted.size).toBe(measurements.length)
    expect(missingMeasurements(measurements, persisted)).toEqual([])
    expect(new Set(measurements.map((item) => item.channelType))).toEqual(new Set(channels))
  })

  it('mantém import completo inalterado', () => {
    const persisted = new Set(measurements.map((item) => rawRecoveryKey(item.rowNumber, item.columnIndex)))
    expect(missingMeasurements(measurements, persisted)).toHaveLength(0)
  })

  it('não duplica flags após nova interrupção e segunda retomada', () => {
    const flags = measurements.slice(0, 4).map((item) => ({ measurementId: rawRecoveryKey(item.rowNumber, item.columnIndex), flagType: 'NULL_VALUE' as const, algorithmVersion: 'raw-import-v1' }))
    const persisted = new Set([flagRecoveryKey(flags[0].measurementId, flags[0].flagType, flags[0].algorithmVersion)])
    missingFlags(flags, persisted).slice(0, 1).forEach((flag) => persisted.add(flagRecoveryKey(flag.measurementId, flag.flagType, flag.algorithmVersion)))
    missingFlags(flags, persisted).forEach((flag) => persisted.add(flagRecoveryKey(flag.measurementId, flag.flagType, flag.algorithmVersion)))
    expect(persisted.size).toBe(flags.length)
    expect(missingFlags(flags, persisted)).toEqual([])
  })

  it('mantém lotes determinísticos para retomadas', () => expect(recoveryBatches(measurements, 6).map((batch) => batch.length)).toEqual([6, 6, 6, 2]))
  it('resolve flags por coluna sem exceder a página relacional', () => {
    const flags = Array.from({ length: 500 }, (_, index) => ({ rowNumber: index + 1, columnIndex: index % 4 + 1 }))
    const groups = [...groupFlagsByColumn(flags).values()]
    expect(groups).toHaveLength(4)
    expect(groups.every((group) => group.length === 125)).toBe(true)
  })
})
