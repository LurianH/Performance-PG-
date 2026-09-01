import { parseLocalTimestamp, parseLocaleNumber } from './parser'
import type { ColumnMapping, ImportSource, ParsedTable } from './types'

type ReadinessInput = {
  fileSelected: boolean
  bytesReady: boolean
  hashReady: boolean
  table: ParsedTable | null
  source: ImportSource | null
  mappings: ColumnMapping[]
}

export type ImportReadiness = { ready: boolean; reasons: string[] }

export function getImportReadiness(input: ReadinessInput): ImportReadiness {
  const reasons: string[] = []
  const { table, source, mappings } = input
  const timestamps = mappings.filter((item) => item.channelType === 'TIMESTAMP')
  const dataChannels = mappings.filter((item) => !['IGNORE', 'TIMESTAMP'].includes(item.channelType))

  if (!input.fileSelected || !input.bytesReady || !input.hashReady) reasons.push('Arquivo ainda não foi carregado e identificado por hash.')
  if (!table || table.headers.length === 0 || table.rows.length === 0) reasons.push('O parsing não produziu cabeçalho e linhas para a prévia.')
  if (table?.hasHeader === null) reasons.push('Confirme se a primeira linha é cabeçalho ou dado.')
  if (table?.encoding !== 'XLSX' && !table?.delimiter) reasons.push('O delimitador do arquivo texto não foi definido.')
  if (!source) reasons.push('A origem da série não foi selecionada.')
  if (timestamps.length !== 1) reasons.push('Mapeie exatamente uma coluna como TIMESTAMP.')
  if (dataChannels.length === 0) reasons.push('Mapeie ao menos uma coluna de medição.')
  if (dataChannels.some((item) => !item.unit)) reasons.push('Confirme a unidade de todos os canais mapeados.')

  if (source?.type === 'SUPPLY_OUTLET') {
    if (dataChannels.some((item) => !['PRESSURE_SUPPLY', 'FLOW'].includes(item.channelType))) {
      reasons.push('Saída do reservatório aceita somente PRESSURE_SUPPLY e/ou FLOW.')
    }
    if (dataChannels.some((item) => item.channelType === 'PRESSURE_SUPPLY' && item.unit !== 'mca')) {
      reasons.push('PRESSURE_SUPPLY deve manter a unidade original mca.')
    }
  }

  if (table && timestamps.length === 1 && !table.rows.some((row) => parseLocalTimestamp(row[timestamps[0].index]) !== null)) {
    reasons.push('Nenhum timestamp válido foi encontrado para gerar a prévia.')
  }
  if (table && dataChannels.length > 0 && !table.rows.some((row) => dataChannels.some((item) => parseLocaleNumber(row[item.index]) !== undefined && parseLocaleNumber(row[item.index]) !== null))) {
    reasons.push('Nenhum valor numérico válido foi encontrado nos canais mapeados.')
  }

  return { ready: reasons.length === 0, reasons }
}
