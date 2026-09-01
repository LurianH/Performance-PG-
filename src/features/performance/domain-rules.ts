export function calculateVp(vd: number | null, vcm: number | null): number | null {
  return vd === null || vcm === null ? null : vd - vcm
}

export function calculateReduction(baselineVp: number | null, vp: number | null): number | null {
  return baselineVp === null || vp === null ? null : baselineVp - vp
}

export function calculateAttainment(reduction: number | null, targetReduction: number | null): number | null {
  if (reduction === null || targetReduction === null) return null
  if (targetReduction <= 0) throw new RangeError('A meta de redução deve ser positiva.')
  return (reduction / targetReduction) * 100
}

export function scenarioLifecycle(active: boolean) {
  return { selectable: active, retainedInHistory: true } as const
}

export function isConsolidatedPerformance(status: string): boolean { return status === 'REALIZED' }

export function assertDistinctContractStages(rows: Array<{ competence: string; status: string }>): boolean {
  const seen = new Set<string>()
  for (const row of rows) {
    const key = `${row.competence}|${row.status}`
    if (seen.has(key)) return false
    seen.add(key)
  }
  return true
}
