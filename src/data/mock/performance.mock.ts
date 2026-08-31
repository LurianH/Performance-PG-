import type { PerformanceMonthMock } from '../../types/domain'

/** MOCK/DEMONSTRAÇÃO: valores estáticos transcritos do protótipo visual.
 * Não representam cálculo executado pela aplicação nem resultado oficial. */
export const performanceMonthsMock: PerformanceMonthMock[] = [
  { competence: 'dez/25', vp: 1835341, reduction: 134592, attainment: 43.8, status: 'REALIZADO_ATUAL' },
  { competence: 'jan/26', vp: 1208417, reduction: 761517, attainment: 247.8, status: 'REALIZADO_ATUAL' },
  { competence: 'fev/26', vp: 1002983, reduction: 966951, attainment: 314.65, status: 'REALIZADO_ATUAL' },
  { competence: 'mar/26', vp: 1678342, reduction: 291592, attainment: 94.89, status: 'REALIZADO_ATUAL' },
  { competence: 'abr/26', vp: 1497711, reduction: 472223, attainment: 153.66, status: 'REALIZADO_ATUAL' },
  { competence: 'mai/26', vp: 1520427, reduction: 449507, attainment: 146.27, status: 'REALIZADO_ATUAL' },
  { competence: 'jun/26', vp: 1628995, reduction: 340939, attainment: 110.94, status: 'REALIZADO_ATUAL' },
  { competence: 'jul/26', vp: 1662384, reduction: 307550, attainment: 100.08, status: 'REALIZADO_ATUAL' },
  { competence: 'ago/26', vp: 1513805, reduction: 456129, attainment: 148.43, status: 'PARCIAL' },
  { competence: 'set/26', vp: 1428180, reduction: 541754, attainment: 176.3, status: 'PROJETADO' },
  { competence: 'out/26', vp: 1557062, reduction: 412872, attainment: 134.4, status: 'PROJETADO' },
  { competence: 'nov/26', vp: 1391644, reduction: 578290, attainment: 188.2, status: 'PROJETADO' },
]

export const performanceReferenceMock = {
  baselineVp: 1969934,
  targetReduction100: 307309.626,
  targetVp100: 1662624.374,
  targetVp120: 1601159,
} as const
