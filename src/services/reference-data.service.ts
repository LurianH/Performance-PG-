import { supabase } from '../lib/supabase'
import type { DmcRow, PerformanceContractParameterRow, ReferenceCounts, TechnicalParameterRow } from '../types/database.types'

function client() {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}

async function rows<T>(table: string, select = '*', order?: string): Promise<T[]> {
  let query = client().from(table).select(select)
  if (order) query = query.order(order)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as T[]
}

async function count(table: string): Promise<number> {
  const { count: total, error } = await client().from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  return total ?? 0
}

export const referenceDataService = {
  listDmcs: () => rows<DmcRow>('dmcs', '*', 'name'),
  listContractParameters: () => rows<PerformanceContractParameterRow>('performance_contract_parameters', '*', 'parameter_key'),
  listTechnicalParameters: () => rows<TechnicalParameterRow>('technical_parameters', '*', 'key'),
  listPerformanceMonths: () => rows<unknown>('performance_months', 'id'),
  listProjectionScenarios: () => rows<unknown>('projection_scenarios', 'id'),
  async getCounts(): Promise<ReferenceCounts> {
    const [imports, raw, exclusions, performanceMonths, projectionScenarios, equipmentPeriods] = await Promise.all([
      count('data_imports'), count('raw_measurements'), count('data_exclusions'), count('performance_months'), count('projection_scenarios'), count('equipment_periods'),
    ])
    return { imports, raw, exclusions, performanceMonths, projectionScenarios, equipmentPeriods }
  },
}
