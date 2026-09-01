export type PcDiagnosticClass = 'GREEN' | 'YELLOW' | 'RED_LOW' | 'RED_HIGH' | 'OUTSIDE_CRITICAL_LOW' | 'NO_DATA'

export function isNightMinute(minute: number) { return minute >= 23 * 60 || minute < 5 * 60 }
export function isCriticalMinute(minute: number) { return minute >= 23 * 60 + 15 || minute < 4 * 60 + 45 }

export function classifyPcDiagnostic(value: number | null, minute: number): PcDiagnosticClass {
  if (value === null) return 'NO_DATA'
  if (value > 50) return 'RED_HIGH'
  if (value < 3.2) return isCriticalMinute(minute) ? 'RED_LOW' : 'OUTSIDE_CRITICAL_LOW'
  if (value < 10) return 'YELLOW'
  return 'GREEN'
}

export function realSampleDurationHours(currentMs: number, nextMs: number | null, cadenceMinutes: number): number {
  const elapsedMinutes = nextMs === null ? cadenceMinutes : Math.max(0, (nextMs - currentMs) / 60_000)
  return Math.min(elapsedMinutes, cadenceMinutes) / 60
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function robustOutlier(value: number, values: number[], multiplier = 6): boolean {
  const center = median(values)
  if (center === null) return false
  const mad = median(values.map((item) => Math.abs(item - center)))
  return mad !== null && mad > 0 && Math.abs(value - center) > multiplier * mad
}

export function hydraulicTrend(currentBelow10: number, previousBelow10: number | null) {
  if (previousBelow10 === null) return 'NO_BASELINE' as const
  if (currentBelow10 < previousBelow10 * 0.9) return 'IMPROVEMENT' as const
  if (currentBelow10 > previousBelow10 * 1.1) return 'WORSENING' as const
  return 'STABLE' as const
}
