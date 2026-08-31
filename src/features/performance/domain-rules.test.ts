import { describe, expect, it } from 'vitest'
import { calculateAttainment, calculateReduction, calculateVp, scenarioLifecycle } from './domain-rules'

describe('regras puras de performance contratual', () => {
  it('calcula VP = VD - VCM', () => {
    expect(calculateVp(3_000_000, 1_500_000)).toBe(1_500_000)
  })

  it('não transforma entrada ausente em zero', () => {
    expect(calculateVp(null, 1_500_000)).toBeNull()
    expect(calculateVp(3_000_000, null)).toBeNull()
  })

  it('calcula redução contra o baseline', () => {
    expect(calculateReduction(1_969_934, 1_662_624.374)).toBeCloseTo(307_309.626)
  })

  it('calcula atingimento percentual', () => {
    expect(calculateAttainment(307_309.626, 307_309.626)).toBeCloseTo(100)
  })

  it('preserva ausência nos cálculos derivados', () => {
    expect(calculateReduction(1_969_934, null)).toBeNull()
    expect(calculateAttainment(null, 307_309.626)).toBeNull()
  })

  it('retorna redução NULL quando baseline está ausente', () => {
    expect(calculateReduction(null, 1_500_000)).toBeNull()
  })

  it('retorna atingimento NULL quando target está ausente', () => {
    expect(calculateAttainment(300_000, null)).toBeNull()
  })

  it('mantém cenário inativo no histórico sem deixá-lo selecionável', () => {
    expect(scenarioLifecycle(false)).toEqual({ selectable: false, retainedInHistory: true })
  })
})
