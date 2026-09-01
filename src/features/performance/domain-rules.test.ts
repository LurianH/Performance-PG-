import { describe, expect, it } from 'vitest'
import { assertDistinctContractStages, calculateAttainment, calculateReduction, calculateVp, isConsolidatedPerformance, scenarioLifecycle } from './domain-rules'

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

  it.each([
    [4_124_696,2_289_355,1_835_341,134_593],
    [4_126_942,2_918_525,1_208_417,761_517],
    [3_477_706,2_474_723,1_002_983,966_951],
    [3_875_139,2_196_797,1_678_342,291_592],
    [3_833_288,2_335_577,1_497_711,472_223],
    [3_754_421,2_233_994,1_520_427,449_507],
    [3_653_477,2_024_482,1_628_995,340_939],
    [3_677_306,2_014_922,1_662_384,307_550],
    [3_521_180,2_007_375,1_513_805,456_129],
    [3_462_153,2_033_973,1_428_180,541_754],
    [3_610_736,2_053_673,1_557_063,412_871],
    [3_560_379,2_168_735,1_391_644,578_290],
  ])('valida VD %s − VCM %s = VP e redução oficial derivada', (vd,vcm,vp,reduction) => {
    expect(calculateVp(vd,vcm)).toBe(vp)
    expect(calculateReduction(1_969_934,vp)).toBe(reduction)
  })

  it('nunca consolida parcial ou projetado como realizado', () => {
    expect(isConsolidatedPerformance('REALIZED')).toBe(true)
    expect(isConsolidatedPerformance('PARTIAL')).toBe(false)
    expect(isConsolidatedPerformance('PROJECTED')).toBe(false)
    expect(assertDistinctContractStages([{ competence:'2026-08',status:'PARTIAL' },{ competence:'2026-09',status:'PROJECTED' }])).toBe(true)
  })
})
