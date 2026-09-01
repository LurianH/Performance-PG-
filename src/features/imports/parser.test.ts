import { describe, expect, it } from 'vitest'
import { decodeBytes, detectDelimiter, detectEncoding, detectHeaderMode, importContextKey, normalizeHeader, parseDelimitedText, parseLocaleNumber, parseLocalTimestamp, prevalidate, serializeMappings, sha256Hex, suggestMapping } from './parser'
import type { ColumnMapping, ParsedTable } from './types'

const mappings = (channel: ColumnMapping['channelType'] = 'PRESSURE_PC', unit = 'mca'): ColumnMapping[] => [
  { index: 0, headerOriginal: 'Data e hora', displayName: 'Data e hora', headerNormalized: 'data e hora', channelType: 'TIMESTAMP', unit: null, confidence: 'HIGH' },
  { index: 1, headerOriginal: 'Pressão 1 (mca)', displayName: 'Pressão 1 (mca)', headerNormalized: 'pressao 1 mca', channelType: channel, unit, confidence: 'HIGH' },
]
const table = (rows: unknown[][]): ParsedTable => ({ headers: ['Data e hora', 'Pressão 1 (mca)'], rows, encoding: 'UTF-8', delimiter: ';', hasHeader: true, physicalRowCount: rows.length + 1, suggestedHeaderMode: 'PRESENT', headerConfidence: 'HIGH' })

describe('parser RAW', () => {
  it('detecta e lê UTF-8 com BOM', () => { const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('Pressão')]); expect(detectEncoding(bytes)).toBe('UTF-8'); expect(decodeBytes(bytes, 'UTF-8')).toContain('Pressão') })
  it('detecta e lê Windows-1252', () => { const bytes = new Uint8Array([0x50,0x72,0x65,0x73,0x73,0xe3,0x6f,0xff]); expect(detectEncoding(bytes)).toBe('WINDOWS-1252'); expect(decodeBytes(bytes, 'WINDOWS-1252')).toContain('Pressão') })
  it.each([['a;b\n1;2',';'],['a,b\n1,2',','],['a\tb\n1\t2','\t']])('detecta delimitador', (text, expected) => expect(detectDelimiter(text)).toBe(expected))
  it('respeita CSV com aspas', () => expect(parseDelimitedText('data,valor\n"01/01/2026 00:00","12,34"', ',').rows[0][1]).toBe('12,34'))
  it('preserva a primeira linha de CSV sem cabeçalho', () => expect(parseDelimitedText('01/11/2025 00:00;25.00\n01/11/2025 00:15;25.08', ';', 'UTF-8', 'ABSENT').rows[0]).toEqual(['01/11/2025 00:00', '25.00']))
  it('não transforma cabeçalho em dado', () => expect(parseDelimitedText('Data e hora;Pressão 1 (mca)\n01/11/2025 00:00;17.33', ';', 'UTF-8', 'PRESENT').rows).toEqual([['01/11/2025 00:00', '17.33']]))
  it('sugere ausência de cabeçalho pela estrutura das linhas', () => expect(detectHeaderMode([['01/11/2025 00:00','25.00'],['01/11/2025 00:15','25.08'],['01/11/2025 00:30','3.27']])).toEqual({ suggestedMode: 'ABSENT', confidence: 'HIGH' }))
  it('permite sobrescrever a sugestão sem descartar silenciosamente', () => { const text = '01/11/2025 00:00;25.00\n01/11/2025 00:15;25.08'; expect(parseDelimitedText(text, ';', 'UTF-8', 'AUTO').rows).toHaveLength(2); expect(parseDelimitedText(text, ';', 'UTF-8', 'PRESENT').rows).toHaveLength(1) })
  it('gera nomes neutros para arquivo sem cabeçalho', () => expect(parseDelimitedText('01/11/2025 00:00;25.00', ';', 'UTF-8', 'ABSENT').headers).toEqual(['Coluna 1', 'Coluna 2']))
  it.each([
    ['9.49', 9.49],
    ['375.68408', 375.68408],
    ['0.00', 0],
    ['1,25', 1.25],
    ['12,34', 12.34],
    ['12.34', 12.34],
    [12.34, 12.34],
    ['', null],
  ])('interpreta decimal sem remover o separador indiscriminadamente', (input, expected) => expect(parseLocaleNumber(input)).toBe(expected))
  it.each([['1.234,56', 1234.56], ['1,234.56', 1234.56], ['1.234.567', 1234567], ['1,234,567', 1234567]])('remove separador de milhar apenas em agrupamento inequívoco', (input, expected) => expect(parseLocaleNumber(input)).toBe(expected))
  it.each(['1.23.45', '1,23,45', '12.34,56', 'valor'])('recusa agrupamento numérico inválido', (input) => expect(parseLocaleNumber(input)).toBeUndefined())
  it('preserva texto decimal no payload RAW e usa o número interpretado na medição', () => {
    const result = prevalidate(table([['01/01/2026 00:00', '375.68408']]), mappings('FLOW', 'm3_h'))
    expect(result.measurements[0]).toMatchObject({ rawValue: 375.68408, unit: 'm3_h', rawPayload: { '1:Pressão 1 (mca)': '375.68408' } })
  })
  it.each([['01/01/2026 12:30','2026-01-01T15:30:00.000Z'],['01/01/2026 12:30:45','2026-01-01T15:30:45.000Z']])('interpreta horário local de São Paulo', (input, expected) => expect(parseLocalTimestamp(input)).toBe(expected))
  it('interpreta Date de célula Excel como componentes locais', () => expect(parseLocalTimestamp(new Date(Date.UTC(2026, 0, 1, 12, 30)))).toBe('2026-01-01T15:30:00.000Z'))
  it('gera hash estável sobre bytes', async () => { const bytes = new TextEncoder().encode('fixture').buffer; expect(await sha256Hex(bytes)).toBe(await sha256Hex(bytes)) })
  it('normaliza cabeçalho com problema Pressăo', () => expect(normalizeHeader('Pressăo Montante')).toBe('pressao montante'))
  it('sugere PC com alta confiança pelo pc_channel', () => expect(suggestMapping(['49952441 - Pressão 1 (mca)'], '49952441 - Pressão 1 (mca)')[0]).toMatchObject({ channelType: 'PRESSURE_PC', confidence: 'HIGH' }))
  it('sugere pressão de alimentação para saída do reservatório', () => expect(suggestMapping(['Pressão (mca)'], null, 'PRESSURE_SUPPLY')[0]).toMatchObject({ channelType: 'PRESSURE_SUPPLY', unit: 'mca' }))
  it('serializa ausência de cabeçalho, índice, canal e unidade', () => { const values = suggestMapping(['Coluna 1', 'Coluna 2'], null, 'PRESSURE_SUPPLY', false); values[0].channelType = 'TIMESTAMP'; values[1].channelType = 'PRESSURE_SUPPLY'; values[1].unit = 'mca'; expect(serializeMappings(values, false)).toEqual([{ has_header: false, column_index: 0, header_original: null, display_name: 'Coluna 1', channel_type: 'TIMESTAMP', unit: null }, { has_header: false, column_index: 1, header_original: null, display_name: 'Coluna 2', channel_type: 'PRESSURE_SUPPLY', unit: 'mca' }]) })
  it('recalcula preview, contagem e período sem alterar o hash', async () => { const text = '01/11/2025 00:00;25.00\n01/11/2025 00:15;25.08'; const bytes = new TextEncoder().encode(text).buffer; const hashBefore = await sha256Hex(bytes); const absent = parseDelimitedText(text, ';', 'UTF-8', 'ABSENT'); const present = parseDelimitedText(text, ';', 'UTF-8', 'PRESENT'); expect(absent.physicalRowCount).toBe(present.physicalRowCount); expect(absent.rows).toHaveLength(2); expect(present.rows).toHaveLength(1); expect(absent.rows[0]).toEqual(['01/11/2025 00:00','25.00']); expect(await sha256Hex(bytes)).toBe(hashBefore) })
  it('aceita Booster somente timestamp e PC', () => expect(prevalidate(table([['01/01/2026 00:00','10']]), mappings()).measurements).toHaveLength(1))
  it.each([['PRESSURE_SUPPLY','mca'],['FLOW','m3_h'],['FLOW','l_s']] as const)('aceita arquivo independente por canal', (channel, unit) => { const result = prevalidate(table([['01/01/2026 00:00','10']]), mappings(channel, unit)); expect(result.measurements[0]).toMatchObject({ channelType: channel, unit }) })
  it('preserva zero e o mantém apenas como revisão', () => { const result = prevalidate(table([['01/01/2026 00:00','0'],['01/01/2026 00:15','0'],['01/01/2026 00:30','0'],['01/01/2026 00:45','0']]), mappings()); expect(result.measurements.every((item) => item.rawValue === 0)).toBe(true); expect(result.flags.find((flag) => flag.flagType === 'ZERO_STREAK')?.severity).toBe('WARNING') })
  it('não transforma NULL em zero', () => { const result = prevalidate(table([['01/01/2026 00:00','']]), mappings()); expect(result.measurements[0].rawValue).toBeNull(); expect(result.flags[0].flagType).toBe('NULL_VALUE') })
  it('registra gap sem inventar leitura', () => { const result = prevalidate(table([['01/01/2026 00:00','1'],['01/01/2026 00:15','2'],['01/01/2026 01:00','3']]), mappings()); expect(result.measurements).toHaveLength(3); expect(result.gapCount).toBe(1); expect(result.flags.some((flag) => flag.flagType === 'MISSING_TIMESTAMP')).toBe(true) })
  it('registra o mesmo gap temporal em cada canal mapeado', () => {
    const multiChannelTable: ParsedTable = { headers: ['Data e hora', 'PC', 'Vazão'], rows: [['01/01/2026 00:00','1','10'],['01/01/2026 00:15','2','20'],['01/01/2026 01:00','3','30']], encoding: 'UTF-8', delimiter: ';', hasHeader: true, physicalRowCount: 4, suggestedHeaderMode: 'PRESENT', headerConfidence: 'HIGH' }
    const multiChannelMappings: ColumnMapping[] = [mappings()[0], mappings()[1], { index: 2, headerOriginal: 'Vazão', displayName: 'Vazão', headerNormalized: 'vazao', channelType: 'FLOW', unit: 'm3_h', confidence: 'HIGH' }]
    const result = prevalidate(multiChannelTable, multiChannelMappings)
    const gapFlags = result.flags.filter((flag) => flag.flagType === 'MISSING_TIMESTAMP')
    expect(result.gapCount).toBe(1)
    expect(gapFlags.map((flag) => flag.columnIndex)).toEqual([1, 2])
  })
  it('preserva duplicidades internas', () => { const result = prevalidate(table([['01/01/2026 00:00','1'],['01/01/2026 00:00','2']]), mappings()); expect(result.measurements).toHaveLength(2); expect(result.duplicateCount).toBe(1); expect(result.flags.find((flag) => flag.flagType === 'DUPLICATE')?.details.conflictingValue).toBe(true) })
  it('rejeita timestamp inválido com payload rastreável', () => { const result = prevalidate(table([['data impossível','7']]), mappings()); expect(result.measurements).toHaveLength(0); expect(result.rejectedRows[0]).toMatchObject({ rowNumber: 2, reasonCode: 'INVALID_TIMESTAMP' }) })
  it('forma chave idempotente por hash, origem e escopo', () => expect(importContextKey('abc','DMC','dmc-1')).toBe('abc|DMC|dmc-1'))
})
