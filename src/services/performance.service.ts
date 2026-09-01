import { supabase } from '../lib/supabase'
import type { ContractDashboardData, PerformanceContractParameterRow, PerformanceMonthDerivedRow, ProjectionScenarioRow, ProjectionValueDerivedRow } from '../types/database.types'

function client() { if (!supabase) throw new Error('Supabase não configurado.'); return supabase }

export async function getContractDashboard(): Promise<ContractDashboardData> {
  const [monthsResult, parametersResult, scenarioResult] = await Promise.all([
    client().from('performance_months_derived').select('*').order('competence'),
    client().from('performance_contract_parameters').select('*').lte('effective_from', '2025-12-01').or('effective_to.is.null,effective_to.gte.2025-12-01'),
    client().from('projection_scenarios').select('*').eq('active', true).eq('name', 'Projeção técnica oficial ETAPA 9').maybeSingle(),
  ])
  const error = monthsResult.error ?? parametersResult.error ?? scenarioResult.error
  if (error) throw error
  const scenario = scenarioResult.data as ProjectionScenarioRow | null
  let projections: ProjectionValueDerivedRow[] = []
  if (scenario) {
    const result = await client().from('projection_values_derived').select('*').eq('scenario_id', scenario.id).order('competence')
    if (result.error) throw result.error
    projections = result.data as ProjectionValueDerivedRow[]
  }
  const parameters = parametersResult.data as PerformanceContractParameterRow[]
  const numeric = (key: string) => Number(parameters.find((item) => item.parameter_key === key)?.numeric_value ?? 0)
  return { months: monthsResult.data as PerformanceMonthDerivedRow[], projections, scenario, baseline: numeric('VP_BASELINE'), targetReduction100: numeric('REDUCTION_TARGET_100'), referenceReduction120: numeric('REDUCTION_TARGET_120') }
}
