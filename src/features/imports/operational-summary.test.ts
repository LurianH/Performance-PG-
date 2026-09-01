import { describe, expect, it } from 'vitest'
import type { DataImportRow } from '../../types/database.types'
import { calculateCoverage, readImportDescriptor, summarizeFlags } from './operational-summary'

const imported: DataImportRow = {
  id: 'import-1', filename: 'serie.csv', original_filename: 'série.csv', file_hash: 'hash', source_type: 'SUPPLY_OUTLET', dmc_id: null, supply_group: 'XIXOVA', imported_by: 'user-1', imported_at: '2026-09-01T12:00:00Z', row_count: 4, accepted_count: 4, rejected_count: 0, status: 'COMPLETED', storage_path: 'path', file_size_bytes: 100, file_extension: 'csv', mime_type: 'text/csv',
  mapping_json: [{ channel_type: 'TIMESTAMP', unit: null }, { channel_type: 'FLOW', unit: 'l_s' }],
  metadata_json: { first_reading: '2026-01-01T03:00:00Z', last_reading: '2026-01-01T04:00:00Z', predominant_cadence_minutes: 15 },
}

describe('resumo operacional de importação', () => {
  it('extrai canal, unidade e período dos snapshots imutáveis', () => expect(readImportDescriptor(imported)).toMatchObject({ channelType: 'FLOW', rawUnit: 'l_s', normalizedUnit: 'l_s', cadenceMinutes: 15 }))
  it('calcula cobertura sem hardcode e limita em 100%', () => { expect(calculateCoverage('2026-01-01T03:00:00Z', '2026-01-01T04:00:00Z', 15, 4)).toBe(80); expect(calculateCoverage('2026-01-01T03:00:00Z', '2026-01-01T04:00:00Z', 15, 8)).toBe(100) })
  it('resume flags e soma ausências sem materializar timestamps', () => expect(summarizeFlags([
    { flag_type: 'MISSING_TIMESTAMP', severity: 'WARNING', details: { missingCount: 3 } },
    { flag_type: 'MISSING_TIMESTAMP', severity: 'WARNING', details: { missingCount: 2 } },
    { flag_type: 'ZERO_STREAK', severity: 'WARNING', details: { length: 4 } },
  ])).toEqual({ total: 3, breakdown: [{ type: 'MISSING_TIMESTAMP', severity: 'WARNING', count: 2 }, { type: 'ZERO_STREAK', severity: 'WARNING', count: 1 }], gaps: 2, missingTimestamps: 5 }))
})
