import { describe, expect, it } from 'vitest'
import type { DataImportRow } from '../../types/database.types'
import { parseDelimitedText, prevalidate, suggestMapping } from './parser'
import { calculateCoverage, formatImportDecimal, readImportChannels, readImportDescriptor, summarizeFlags, summarizePrevalidationChannels } from './operational-summary'

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
  it('calcula cobertura sem hardcode e limita em 100%', () => { expect(calculateCoverage('2026-01-01T03:00:00Z', '2026-01-01T04:00:00Z', 15, 4)).toBe(80); expect(calculateCoverage('2026-01-01T03:00:00Z', '2026-01-01T04:00:00Z', 15, 8)).toBe(100) })
  it('resume flags e soma ausências sem materializar timestamps', () => expect(summarizeFlags([
    { flag_type: 'MISSING_TIMESTAMP', severity: 'WARNING', details: { missingCount: 3 } },
    { flag_type: 'MISSING_TIMESTAMP', severity: 'WARNING', details: { missingCount: 2 } },
    { flag_type: 'ZERO_STREAK', severity: 'WARNING', details: { length: 4 } },
  ])).toEqual({ total: 3, breakdown: [{ type: 'MISSING_TIMESTAMP', severity: 'WARNING', count: 2 }, { type: 'ZERO_STREAK', severity: 'WARNING', count: 1 }], gaps: 2, missingTimestamps: 5 }))
  it('mantém decimal com ponto no preview DMC sem multiplicar o valor por mil', () => {
    const table = parseDelimitedText('Data e hora;Vazão Instantânea 1 (m³/h)\n01/01/2026 00:00;375.68408', ';', 'UTF-8', 'PRESENT')
    const mappings = suggestMapping(table.headers)
    const result = prevalidate(table, mappings)
    const flow = summarizePrevalidationChannels(result, mappings).find((channel) => channel.mapping.channelType === 'FLOW')
    expect(result.measurements[0].rawValue).toBe(375.68408)
    expect(flow?.maximum).toBe(375.68408)
    expect(flow?.maximum).not.toBe(375684.08)
    expect(formatImportDecimal(flow?.maximum ?? null)).toBe('375,68408')
  })
})
