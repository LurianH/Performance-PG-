import { useCallback, useMemo } from 'react'
import { useAuth } from '../features/auth/useAuth'
import { referenceDataService } from '../services/reference-data.service'
import { hydraulicDiagnosticsService } from '../services/hydraulic-diagnostics.service'
import type { DataImportRow, DmcCoverage, DmcHydraulicDailyRow, DmcHydraulicMonthlyRow, DmcRow, DmcSeriesSummary, PerformanceContractParameterRow, ReferenceCounts, SupplySeriesSummary, TechnicalParameterRow } from '../types/database.types'
import { useReferenceQuery } from './useReferenceQuery'

const EMPTY_ROWS: never[] = []
const EMPTY_COUNTS: ReferenceCounts = { imports: 0, raw: 0, exclusions: 0, flags: 0, rejectedRows: 0, gaps: 0, duplicates: 0, performanceMonths: 0, projectionScenarios: 0, equipmentPeriods: 0 }

function useRealMode() { return !useAuth().isMockMode }

export function useDmcs() {
  const enabled = useRealMode()
  const loader = useCallback(() => referenceDataService.listDmcs(), [])
  return useReferenceQuery<DmcRow[]>(loader, EMPTY_ROWS, enabled)
}

export function useContractParameters() {
  const enabled = useRealMode()
  const loader = useCallback(() => referenceDataService.listContractParameters(), [])
  return useReferenceQuery<PerformanceContractParameterRow[]>(loader, EMPTY_ROWS, enabled)
}

export function useTechnicalParameters() {
  const enabled = useRealMode()
  const loader = useCallback(() => referenceDataService.listTechnicalParameters(), [])
  return useReferenceQuery<TechnicalParameterRow[]>(loader, EMPTY_ROWS, enabled)
}

export function useReferenceCounts() {
  const enabled = useRealMode()
  const loader = useCallback(() => referenceDataService.getCounts(), [])
  return useReferenceQuery<ReferenceCounts>(loader, EMPTY_COUNTS, enabled)
}

export function useDmcCoverage() {
  const enabled = useRealMode()
  const loader = useCallback(() => referenceDataService.getDmcCoverage(), [])
  return useReferenceQuery<DmcCoverage[]>(loader, EMPTY_ROWS, enabled)
}

export function useImports() {
  const enabled = useRealMode()
  const loader = useCallback(() => referenceDataService.listImports(), [])
  return useReferenceQuery<DataImportRow[]>(loader, EMPTY_ROWS, enabled)
}

export function useSupplySeries() {
  const enabled = useRealMode()
  const loader = useCallback(() => referenceDataService.getSupplySeries(), [])
  return useReferenceQuery<SupplySeriesSummary[]>(loader, EMPTY_ROWS, enabled)
}

export function useDmcSeries() {
  const enabled = useRealMode()
  const loader = useCallback(() => referenceDataService.getDmcSeries(), [])
  return useReferenceQuery<DmcSeriesSummary[]>(loader, EMPTY_ROWS, enabled)
}

export function useHydraulicOverview() {
  const enabled = useRealMode()
  const loader = useCallback(() => hydraulicDiagnosticsService.listLatestMonthly(), [])
  return useReferenceQuery<DmcHydraulicMonthlyRow[]>(loader, EMPTY_ROWS, enabled)
}

export function useHydraulicDmcDetail(dmcId: string | undefined) {
  const enabled = useRealMode() && Boolean(dmcId)
  const loader = useCallback(() => dmcId ? hydraulicDiagnosticsService.getDmcDetail(dmcId) : Promise.resolve({ daily: [], monthly: [] }), [dmcId])
  return useReferenceQuery<{ daily: DmcHydraulicDailyRow[]; monthly: DmcHydraulicMonthlyRow[] }>(loader, { daily: [], monthly: [] }, enabled)
}

export function useOfficialEmptyStates() {
  const enabled = useRealMode()
  const monthLoader = useCallback(() => referenceDataService.listPerformanceMonths(), [])
  const scenarioLoader = useCallback(() => referenceDataService.listProjectionScenarios(), [])
  const months = useReferenceQuery<unknown[]>(monthLoader, EMPTY_ROWS, enabled)
  const scenarios = useReferenceQuery<unknown[]>(scenarioLoader, EMPTY_ROWS, enabled)
  return useMemo(() => ({ months, scenarios }), [months, scenarios])
}
