import { describe, expect, it } from 'vitest'
import { classifyPcDiagnostic, hydraulicTrend, isCriticalMinute, isNightMinute, realSampleDurationHours, robustOutlier } from './diagnostic-engine'

describe('motor de diagnóstico hidráulico DMC', () => {
  it('respeita os limites inclusivos e a janela crítica do PC', () => {
    expect(classifyPcDiagnostic(10, 23 * 60)).toBe('GREEN')
    expect(classifyPcDiagnostic(50, 60)).toBe('GREEN')
    expect(classifyPcDiagnostic(3.2, 60)).toBe('YELLOW')
    expect(classifyPcDiagnostic(3.19, 23 * 60 + 15)).toBe('RED_LOW')
    expect(classifyPcDiagnostic(3.19, 23 * 60)).toBe('OUTSIDE_CRITICAL_LOW')
    expect(classifyPcDiagnostic(50.01, 12 * 60)).toBe('RED_HIGH')
  })

  it('define janelas noturna e crítica sem deslocar os limites', () => {
    expect(isNightMinute(23 * 60)).toBe(true)
    expect(isNightMinute(5 * 60)).toBe(false)
    expect(isCriticalMinute(23 * 60 + 15)).toBe(true)
    expect(isCriticalMinute(4 * 60 + 45)).toBe(false)
  })

  it('calcula duração pelo intervalo real e limita gaps à cadência', () => {
    const start = Date.parse('2025-11-01T00:00:00Z')
    expect(realSampleDurationHours(start, start + 15 * 60_000, 15)).toBe(0.25)
    expect(realSampleDurationHours(start, start + 180 * 60_000, 15)).toBe(0.25)
  })

  it('detecta outlier por mediana e MAD sem remover a observação', () => {
    const values = [9, 10, 10, 11, 10.5, 100]
    expect(robustOutlier(100, values)).toBe(true)
    expect(robustOutlier(10, values)).toBe(false)
    expect(values).toContain(100)
  })

  it('classifica tendência por variação material de horas abaixo de 10', () => {
    expect(hydraulicTrend(8, 10)).toBe('IMPROVEMENT')
    expect(hydraulicTrend(12, 10)).toBe('WORSENING')
    expect(hydraulicTrend(10.5, 10)).toBe('STABLE')
    expect(hydraulicTrend(10, null)).toBe('NO_BASELINE')
  })
})
