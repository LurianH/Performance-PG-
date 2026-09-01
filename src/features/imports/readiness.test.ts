import { describe, expect, it } from 'vitest'
import { getImportReadiness } from './readiness'
import type { ColumnMapping, ParsedTable } from './types'

const table: ParsedTable = {
  headers: ['Data e hora', 'Pressão (mca)'],
  rows: [['01/11/2025 00:00', '17,33']],
  encoding: 'UTF-8',
  delimiter: ';',
  hasHeader: true,
  physicalRowCount: 2,
  suggestedHeaderMode: 'PRESENT',
  headerConfidence: 'HIGH',
}

const mapping = (channelType: ColumnMapping['channelType'], unit: string | null): ColumnMapping[] => [
  { index: 0, headerOriginal: 'Data e hora', displayName: 'Data e hora', headerNormalized: 'data e hora', channelType: 'TIMESTAMP', unit: null, confidence: 'HIGH' },
  { index: 1, headerOriginal: 'Pressão (mca)', displayName: 'Pressão (mca)', headerNormalized: 'pressao mca', channelType, unit, confidence: 'MEDIUM' },
]

const base = {
  fileSelected: true,
  bytesReady: true,
  hashReady: true,
  table,
  source: { type: 'SUPPLY_OUTLET' as const, supplyGroup: 'REDE' as const },
}

describe('prontidão da pré-validação', () => {
  it('habilita REDE pressão somente com TIMESTAMP, PRESSURE_SUPPLY e mca', () => {
    expect(getImportReadiness({ ...base, mappings: mapping('PRESSURE_SUPPLY', 'mca') })).toEqual({ ready: true, reasons: [] })
  })

  it('não exige FLOW, DMC, PRESSURE_PC, montante ou jusante', () => {
    const result = getImportReadiness({ ...base, mappings: mapping('PRESSURE_SUPPLY', 'mca') })
    expect(result.ready).toBe(true)
    expect(result.reasons.join(' ')).not.toMatch(/FLOW|DMC|PRESSURE_PC|montante|jusante/i)
  })

  it('bloqueia pressão de saída mapeada incorretamente como PRESSURE_PC', () => {
    expect(getImportReadiness({ ...base, mappings: mapping('PRESSURE_PC', 'mca') }).reasons).toContain('Saída do reservatório aceita somente PRESSURE_SUPPLY e/ou FLOW.')
  })

  it('bloqueia unidade ausente sem tornar o botão sempre habilitado', () => {
    expect(getImportReadiness({ ...base, mappings: mapping('PRESSURE_SUPPLY', null) }).ready).toBe(false)
  })
})
