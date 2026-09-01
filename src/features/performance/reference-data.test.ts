import { describe, expect, it } from 'vitest'
import type { PerformanceContractParameterRow, TechnicalParameterRow } from '../../types/database.types'
import { displayTechnicalValue, findContractNumericValue } from './reference-data'

const contract = (parameter_key: string, numeric_value: number): PerformanceContractParameterRow => ({
  id: crypto.randomUUID(), parameter_key, numeric_value, text_value: null, effective_from: '2025-12-01', effective_to: null,
  notes: null, created_by: null, created_at: '2026-08-31T00:00:00Z',
})

const technical = (key: string, numeric_value: number | null, text_value: string | null): TechnicalParameterRow => ({
  id: crypto.randomUUID(), key, numeric_value, text_value, json_value: null, effective_from: '2025-10-01T03:00:00Z', effective_to: null,
  notes: null, created_by: null, created_at: '2026-08-31T00:00:00Z',
})

describe('dados oficiais de referência', () => {
  it('obtém baseline e metas exclusivamente das linhas recebidas do banco', () => {
    const rows = [contract('VP_BASELINE', 1969934), contract('REDUCTION_TARGET_100', 307309.626), contract('REDUCTION_TARGET_120', 368775)]
    expect(findContractNumericValue(rows, 'VP_BASELINE')).toBe(1969934)
    expect(findContractNumericValue(rows, 'REDUCTION_TARGET_100')).toBe(307309.626)
    expect(findContractNumericValue(rows, 'REDUCTION_TARGET_120')).toBe(368775)
  })

  it('não converte parâmetro ausente em zero', () => {
    expect(findContractNumericValue([], 'VP_BASELINE')).toBeNull()
    expect(displayTechnicalValue(undefined)).toBe('Não configurado')
  })

  it('preserva valores numéricos e textuais configurados', () => {
    expect(displayTechnicalValue(technical('PC_CRITICAL_MIN', 3.2, null))).toBe('3.2')
    expect(displayTechnicalValue(technical('NIGHT_START', null, '23:00'))).toBe('23:00')
  })
})
