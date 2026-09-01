import { supabase } from '../lib/supabase'
import type { DmcHydraulicDailyRow, DmcHydraulicMonthlyRow } from '../types/database.types'

function client() {
  if (!supabase) throw new Error('Supabase não configurado.')
  return supabase
}

async function latestRunId(): Promise<string | null> {
  const { data, error } = await client().from('analysis_runs').select('id').eq('analysis_type', 'DMC_HYDRAULIC_DIAGNOSTIC').eq('status', 'COMPLETED').order('finished_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

export const hydraulicDiagnosticsService = {
  async listLatestMonthly(): Promise<DmcHydraulicMonthlyRow[]> {
    const runId = await latestRunId()
    if (!runId) return []
    const { data, error } = await client().from('dmc_hydraulic_monthly').select('*').eq('analysis_run_id', runId).order('competence', { ascending: false })
    if (error) throw error
    const latest = new Map<string, DmcHydraulicMonthlyRow>()
    ;(data as DmcHydraulicMonthlyRow[]).forEach((row) => { if (!latest.has(row.dmc_id)) latest.set(row.dmc_id, row) })
    return [...latest.values()]
  },

  async getDmcDetail(dmcId: string): Promise<{ daily: DmcHydraulicDailyRow[]; monthly: DmcHydraulicMonthlyRow[] }> {
    const runId = await latestRunId()
    if (!runId) return { daily: [], monthly: [] }
    const [daily, monthly] = await Promise.all([
      client().from('dmc_hydraulic_daily').select('*').eq('analysis_run_id', runId).eq('dmc_id', dmcId).order('analysis_date'),
      client().from('dmc_hydraulic_monthly').select('*').eq('analysis_run_id', runId).eq('dmc_id', dmcId).order('competence'),
    ])
    if (daily.error) throw daily.error
    if (monthly.error) throw monthly.error
    return { daily: daily.data as DmcHydraulicDailyRow[], monthly: monthly.data as DmcHydraulicMonthlyRow[] }
  },
}
