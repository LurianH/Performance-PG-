import { describe, expect, it } from 'vitest'
import { getImportReadiness } from './readiness'
import type { ColumnMapping, ParsedTable } from './types'
import type { DmcRow } from '../../types/database.types'

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

  it('aceita DMC ativo com subconjunto dos canais suportados', () => {
    const dmc: DmcRow = { id: 'dmc-1', code: null, name: 'DMC Teste', supply_group: 'REDE', pc_channel: 'PC', has_vrp: false, active: true, notes: null, created_at: '', updated_at: '' }
    expect(getImportReadiness({ ...base, source: { type: 'DMC', dmc }, mappings: mapping('PRESSURE_PC', 'mca') })).toEqual({ ready: true, reasons: [] })
    const multiChannel = [...mapping('PRESSURE_PC', 'mca'), { ...mapping('FLOW', 'm3_h')[1], index: 2 }]
    expect(getImportReadiness({ ...base, source: { type: 'DMC', dmc }, mappings: multiChannel }).ready).toBe(true)
  })

  it('não permite continuar sem origem/DMC selecionado', () => expect(getImportReadiness({ ...base, source: null, mappings: mapping('PRESSURE_PC', 'mca') }).reasons).toContain('A origem da série não foi selecionada.'))

  it('bloqueia DMC inativo, canal repetido e unidade de vazão ausente', () => {
    const dmc: DmcRow = { id: 'dmc-1', code: null, name: 'DMC Teste', supply_group: 'REDE', pc_channel: 'PC', has_vrp: false, active: false, notes: null, created_at: '', updated_at: '' }
    const duplicated = [...mapping('FLOW', null), { ...mapping('FLOW', 'm3_h')[1], index: 2 }]
    const result = getImportReadiness({ ...base, source: { type: 'DMC', dmc }, mappings: duplicated })
    expect(result.ready).toBe(false)
    expect(result.reasons).toContain('Selecione um DMC ativo válido.')
    expect(result.reasons).toContain('Mapeie no máximo uma coluna para cada canal do DMC.')
    expect(result.reasons).toContain('Confirme a unidade de todos os canais mapeados.')
  })
})
