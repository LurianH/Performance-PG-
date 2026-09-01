import { describe, expect, it } from 'vitest'
import type { DataImportRow } from '../../types/database.types'
import { prevalidateDelimitedText } from './parser'
import { calculateCoverage, formatImportDecimal, readImportChannels, readImportDescriptor, summarizeFlags, summarizeImportSnapshot, summarizePrevalidationChannels } from './operational-summary'
import type { ColumnMapping } from './types'

const imported: DataImportRow = {
  id: 'import-1', filename: 'serie.csv', original_filename: 'série.csv', file_hash: 'hash', source_type: 'SUPPLY_OUTLET', dmc_id: null, supply_group: 'XIXOVA', imported_by: 'user-1', imported_at: '2026-09-01T12:00:00Z', row_count: 4, accepted_count: 4, rejected_count: 0, status: 'COMPLETED', storage_path: 'path', file_size_bytes: 100, file_extension: 'csv', mime_type: 'text/csv',
  mapping_json: [{ channel_type: 'TIMESTAMP', unit: null }, { channel_type: 'FLOW', unit: 'l_s' }],
  metadata_json: { first_reading: '2026-01-01T03:00:00Z', last_reading: '2026-01-01T04:00:00Z', predominant_cadence_minutes: 15 },
}

describe('resumo operacional de importação', () => {
  it('extrai canal, unidade e período dos snapshots imutáveis', () => expect(readImportDescriptor(imported)).toMatchObject({ channelType: 'FLOW', rawUnit: 'l_s', normalizedUnit: 'l_s', cadenceMinutes: 15 }))
  it('extrai todos os canais mapeados de um import DMC', () => {
    const dmcImport = { ...imported, source_type: 'DMC' as const, dmc_id: 'dmc-1', supply_group: null, mapping_json: [{ channel_type: 'TIMESTAMP', unit: null }, { channel_type: 'PRESSURE_PC', unit: 'mca' }, { channel_type: 'FLOW', unit: 'm3_h' }, { channel_type: 'IGNORE', unit: null }] }
    expect(readImportChannels(dmcImport)).toEqual([{ channelType: 'PRESSURE_PC', rawUnit: 'mca', normalizedUnit: 'mca' }, { channelType: 'FLOW', rawUnit: 'm3_h', normalizedUnit: 'l_s' }])
  })
  it('resume histórico misto de alimentação e DMC somente pelos snapshots', () => {
    const supply = summarizeImportSnapshot(imported)
    const dmc = summarizeImportSnapshot({ ...imported, id: 'import-2', source_type: 'DMC', dmc_id: 'dmc-1', supply_group: null, accepted_count: 10, mapping_json: [{ channel_type: 'TIMESTAMP', unit: null }, { channel_type: 'PRESSURE_PC', unit: 'mca' }, { channel_type: 'FLOW', unit: 'm3_h' }] })
    expect(supply).toMatchObject({ rawCount: 4, channels: [{ channelType: 'FLOW', rawCount: 4 }] })
    expect(dmc).toMatchObject({ rawCount: 20, channels: [{ channelType: 'PRESSURE_PC', rawCount: 10 }, { channelType: 'FLOW', rawCount: 10 }] })
  })
  it('calcula cobertura sem hardcode e limita em 100%', () => { expect(calculateCoverage('2026-01-01T03:00:00Z', '2026-01-01T04:00:00Z', 15, 4)).toBe(80); expect(calculateCoverage('2026-01-01T03:00:00Z', '2026-01-01T04:00:00Z', 15, 8)).toBe(100) })
  it('resume flags e soma ausências sem materializar timestamps', () => expect(summarizeFlags([
    { flag_type: 'MISSING_TIMESTAMP', severity: 'WARNING', details: { missingCount: 3 } },
    { flag_type: 'MISSING_TIMESTAMP', severity: 'WARNING', details: { missingCount: 2 } },
    { flag_type: 'ZERO_STREAK', severity: 'WARNING', details: { length: 4 } },
  ])).toEqual({ total: 3, breakdown: [{ type: 'MISSING_TIMESTAMP', severity: 'WARNING', count: 2 }, { type: 'ZERO_STREAK', severity: 'WARNING', count: 1 }], gaps: 2, missingTimestamps: 5 }))
  it('mantém decimal com ponto no fluxo completo da pré-validação DMC', () => {
    const csv = 'Data e hora;PC;Montante;Jusante;Vazão Instantânea 1 (m³/h);Ignorar\n01/11/2025 00:00;9.49;0;0;375.68408;'
    const mappings: ColumnMapping[] = [
      { index: 0, headerOriginal: 'Data e hora', displayName: 'Data e hora', headerNormalized: 'data e hora', channelType: 'TIMESTAMP', unit: null, confidence: 'HIGH' },
      { index: 1, headerOriginal: 'PC', displayName: 'PC', headerNormalized: 'pc', channelType: 'PRESSURE_PC', unit: 'mca', confidence: 'HIGH' },
      { index: 2, headerOriginal: 'Montante', displayName: 'Montante', headerNormalized: 'montante', channelType: 'PRESSURE_UPSTREAM', unit: 'mca', confidence: 'HIGH' },
      { index: 3, headerOriginal: 'Jusante', displayName: 'Jusante', headerNormalized: 'jusante', channelType: 'PRESSURE_DOWNSTREAM', unit: 'mca', confidence: 'HIGH' },
      { index: 4, headerOriginal: 'Vazão Instantânea 1 (m³/h)', displayName: 'Vazão Instantânea 1 (m³/h)', headerNormalized: 'vazao instantanea 1 m3 h', channelType: 'FLOW', unit: 'm3_h', confidence: 'HIGH' },
      { index: 5, headerOriginal: 'Ignorar', displayName: 'Ignorar', headerNormalized: 'ignorar', channelType: 'IGNORE', unit: null, confidence: 'NONE' },
    ]
    const { result } = prevalidateDelimitedText(csv, ';', 'UTF-8', 'PRESENT', mappings)
    const flow = summarizePrevalidationChannels(result, mappings).find((channel) => channel.mapping.channelType === 'FLOW')
    expect(result.measurements.find((measurement) => measurement.channelType === 'FLOW')?.rawValue).toBe(375.68408)
    expect(flow?.maximum).toBe(375.68408)
    expect(flow?.maximum).not.toBe(375684.08)
    expect(formatImportDecimal(flow?.maximum ?? null)).toBe('375,68408')
  })
})
