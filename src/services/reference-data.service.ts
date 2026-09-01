import { supabase } from '../lib/supabase'
import type { DataImportRow, DmcCoverage, DmcRow, DmcSeriesSummary, PerformanceContractParameterRow, ReferenceCounts, SupplySeriesSummary, TechnicalParameterRow } from '../types/database.types'
import { normalizeMeasurement } from '../features/hydraulics/domain-rules'

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

async function countWhere(table: string, column: string, value: string): Promise<number> {
  const { count: total, error } = await client().from(table).select('*', { count: 'exact', head: true }).eq(column, value)
  if (error) throw error
  return total ?? 0
}

export async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await mapper(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export const referenceDataService = {
  listDmcs: () => rows<DmcRow>('dmcs', '*', 'name'),
  listContractParameters: () => rows<PerformanceContractParameterRow>('performance_contract_parameters', '*', 'parameter_key'),
  listTechnicalParameters: () => rows<TechnicalParameterRow>('technical_parameters', '*', 'key'),
  listPerformanceMonths: () => rows<unknown>('performance_months', 'id'),
  listProjectionScenarios: () => rows<unknown>('projection_scenarios', 'id'),
  listImports: () => rows<DataImportRow>('data_imports', '*', 'imported_at'),
  async getCounts(): Promise<ReferenceCounts> {
    const [imports, raw, exclusions, flags, rejectedRows, gaps, duplicates, performanceMonths, projectionScenarios, equipmentPeriods] = await Promise.all([
      count('data_imports'), count('raw_measurements'), count('measurement_exclusions'), count('measurement_quality_flags'), count('import_rejected_rows'), countWhere('measurement_quality_flags', 'flag_type', 'MISSING_TIMESTAMP'), countWhere('measurement_quality_flags', 'flag_type', 'DUPLICATE'), count('performance_months'), count('projection_scenarios'), count('equipment_periods'),
    ])
    return { imports, raw, exclusions, flags, rejectedRows, gaps, duplicates, performanceMonths, projectionScenarios, equipmentPeriods }
  },
  async getDmcCoverage(): Promise<DmcCoverage[]> {
    const dmcs = await rows<DmcRow>('dmcs', '*', 'name')
    return Promise.all(dmcs.map(async (dmc) => ({ id: dmc.id, name: dmc.name, rawCount: await countWhere('raw_measurements', 'dmc_id', dmc.id) })))
  },
  async getSupplySeries(): Promise<SupplySeriesSummary[]> {
    const imports = (await rows<DataImportRow>('data_imports', '*', 'imported_at')).filter((item) => item.source_type === 'SUPPLY_OUTLET' && item.status === 'COMPLETED' && item.supply_group)
    return Promise.all(imports.map(async (item) => {
      const metadata = (item.metadata_json ?? {}) as Record<string, unknown>
      const mapping = Array.isArray(item.mapping_json) ? item.mapping_json as Array<Record<string, unknown>> : []
      const channel = mapping.find((entry) => entry.channel_type !== 'TIMESTAMP' && entry.channel_type !== 'IGNORE')
      const firstReading = String(metadata.first_reading ?? '')
      const lastReading = String(metadata.last_reading ?? '')
      const cadenceMinutes = typeof metadata.predominant_cadence_minutes === 'number' ? metadata.predominant_cadence_minutes : null
      const rawCount = await countWhere('raw_measurements', 'import_id', item.id)
      const { count: gapCount, error } = await client().from('measurement_quality_flags').select('id,raw_measurements!inner(import_id)', { count: 'exact', head: true }).eq('flag_type', 'MISSING_TIMESTAMP').eq('raw_measurements.import_id', item.id)
      if (error) throw error
      const expected = cadenceMinutes && firstReading && lastReading ? Math.round((Date.parse(lastReading) - Date.parse(firstReading)) / 60000 / cadenceMinutes) + 1 : null
      const channelType = String(channel?.channel_type ?? '—')
      const unit = String(channel?.unit ?? '—')
      const normalizedUnit = normalizeMeasurement(null, channelType, unit).unit
      return { importId: item.id, supplyGroup: item.supply_group!, channelType, unit, normalizedUnit, firstReading, lastReading, rawCount, gapCount: gapCount ?? 0, cadenceMinutes, coveragePercent: expected ? Math.min(100, rawCount / expected * 100) : null }
    }))
  },
  async getDmcSeries(): Promise<DmcSeriesSummary[]> {
    const imports = (await rows<DataImportRow>('data_imports', '*', 'imported_at')).filter((item) => item.source_type === 'DMC' && item.status === 'COMPLETED' && item.dmc_id)
    const channels = imports.flatMap((item) => {
      const metadata = (item.metadata_json ?? {}) as Record<string, unknown>
      const mapping = Array.isArray(item.mapping_json) ? item.mapping_json as Array<Record<string, unknown>> : []
      return mapping.filter((entry) => entry.channel_type !== 'TIMESTAMP' && entry.channel_type !== 'IGNORE').map((channel) => ({ item, metadata, channel }))
    })
    const summaries = await mapWithConcurrency(channels, 4, async ({ item, metadata, channel }): Promise<DmcSeriesSummary> => {
        const channelType = String(channel.channel_type ?? '—')
        const unit = String(channel.unit ?? '—')
        const firstReading = String(metadata.first_reading ?? '')
        const lastReading = String(metadata.last_reading ?? '')
        const cadenceMinutes = typeof metadata.predominant_cadence_minutes === 'number' ? metadata.predominant_cadence_minutes : null
        const rawQuery = client().from('raw_measurements').select('id', { count: 'exact', head: true }).eq('import_id', item.id).eq('channel_type', channelType)
        const gapQuery = client().from('measurement_quality_flags').select('id,raw_measurements!inner(import_id,channel_type)', { count: 'exact', head: true }).eq('flag_type', 'MISSING_TIMESTAMP').eq('raw_measurements.import_id', item.id).eq('raw_measurements.channel_type', channelType)
        const [rawResult, gapResult] = await Promise.all([rawQuery, gapQuery])
        const error = rawResult.error ?? gapResult.error
        if (error) throw error
        const rawCount = rawResult.count ?? 0
        const expected = cadenceMinutes && firstReading && lastReading ? Math.round((Date.parse(lastReading) - Date.parse(firstReading)) / 60000 / cadenceMinutes) + 1 : null
        return { importId: item.id, dmcId: item.dmc_id!, channelType, unit, normalizedUnit: normalizeMeasurement(null, channelType, unit).unit, firstReading, lastReading, rawCount, gapCount: gapResult.count ?? 0, cadenceMinutes, coveragePercent: expected ? Math.min(100, rawCount / expected * 100) : null }
      })
    return summaries
  },
}
