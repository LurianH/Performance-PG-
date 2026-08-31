import { describe, expect, it } from 'vitest'
import {
  canUseMeasurementForHydraulics,
  classifyPcPressure,
  cubicMetersPerHourToLitersPerSecond,
  evaluateMeasurementEligibility,
  isEquipmentAvailable,
  litersPerSecondToCubicMetersPerHour,
} from './domain-rules'

describe('regras puras do diagnóstico hidráulico', () => {
  it('classifica PC = 3,20 mca como faixa baixa/amarela', () => {
    expect(classifyPcPressure(3.2)).toBe('LOW')
  })

  it('classifica PC abaixo de 3,20 mca como crítico', () => {
    expect(classifyPcPressure(3.19)).toBe('CRITICAL')
  })

  it('classifica PC acima de 50 mca como sobrepressão', () => {
    expect(classifyPcPressure(50.01)).toBe('OVERPRESSURE')
  })

  it('preserva NULL como ausência de dado, nunca zero', () => {
    expect(classifyPcPressure(null)).toBe('NO_DATA')
    expect(litersPerSecondToCubicMetersPerHour(null)).toBeNull()
  })

  it('converte L/s e m³/h de forma reversível', () => {
    expect(litersPerSecondToCubicMetersPerHour(10)).toBeCloseTo(36)
    expect(cubicMetersPerHourToLitersPerSecond(36)).toBeCloseTo(10)
  })

  it('classifica equipamento indisponível', () => {
    expect(isEquipmentAvailable('UNAVAILABLE')).toBe(false)
    expect(isEquipmentAvailable('AVAILABLE')).toBe(true)
  })

  it('não usa medição em período NOT_INSTALLED', () => {
    expect(canUseMeasurementForHydraulics(12.5, 'NOT_INSTALLED')).toBe(false)
  })

  it('falha de equipamento FLOW não invalida PRESSURE_PC', () => {
    const result = evaluateMeasurementEligibility({
      rawValue: 8.4,
      channelType: 'PRESSURE_PC',
      equipmentImpacts: [{ channelType: 'FLOW', status: 'FAILED' }],
    })
    expect(result.isValid).toBe(true)
    expect(result.equipmentStatus).toBeNull()
  })

  it('falha de equipamento PRESSURE_PC invalida somente esse canal', () => {
    const pressure = evaluateMeasurementEligibility({
      rawValue: 8.4,
      channelType: 'PRESSURE_PC',
      equipmentImpacts: [{ channelType: 'PRESSURE_PC', status: 'FAILED' }],
    })
    const flow = evaluateMeasurementEligibility({
      rawValue: 25,
      channelType: 'FLOW',
      equipmentImpacts: [{ channelType: 'PRESSURE_PC', status: 'FAILED' }],
    })
    expect(pressure.isValid).toBe(false)
    expect(flow.isValid).toBe(true)
  })

  it('expurgo invalida sem alterar RAW e revogação restaura elegibilidade', () => {
    const excluded = evaluateMeasurementEligibility({
      rawValue: 7.5,
      channelType: 'PRESSURE_PC',
      equipmentImpacts: [],
      exclusionActive: true,
    })
    const revoked = evaluateMeasurementEligibility({
      rawValue: excluded.rawValue,
      channelType: 'PRESSURE_PC',
      equipmentImpacts: [],
      exclusionActive: false,
    })
    expect(excluded.rawValue).toBe(7.5)
    expect(excluded.isValid).toBe(false)
    expect(revoked.rawValue).toBe(7.5)
    expect(revoked.isValid).toBe(true)
  })
})
