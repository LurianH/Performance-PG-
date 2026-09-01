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

export function mappingChannelOptions(sourceType: ImportSource['type'], supplyChannel: 'PRESSURE_SUPPLY' | 'FLOW' = 'PRESSURE_SUPPLY'): ColumnMapping['channelType'][] {
  return sourceType === 'DMC'
    ? ['IGNORE', 'TIMESTAMP', 'PRESSURE_PC', 'PRESSURE_UPSTREAM', 'PRESSURE_DOWNSTREAM', 'FLOW']
    : ['IGNORE', 'TIMESTAMP', supplyChannel]
}

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
  if (source?.type === 'DMC' && (timestamps.length !== 1 || dataChannels.length === 0)) reasons.push('Mapeie exatamente uma coluna como TIMESTAMP e pelo menos um canal de medição do DMC.')
  if (source?.type !== 'DMC' && timestamps.length !== 1) reasons.push('Mapeie exatamente uma coluna como TIMESTAMP.')
  if (source?.type !== 'DMC' && dataChannels.length === 0) reasons.push('Mapeie ao menos uma coluna de medição.')
  if (dataChannels.some((item) => !item.unit)) reasons.push('Confirme a unidade de todos os canais mapeados.')

  if (source?.type === 'SUPPLY_OUTLET') {
    if (dataChannels.some((item) => !['PRESSURE_SUPPLY', 'FLOW'].includes(item.channelType))) {
      reasons.push('Saída do reservatório aceita somente PRESSURE_SUPPLY e/ou FLOW.')
    }
    if (dataChannels.some((item) => item.channelType === 'PRESSURE_SUPPLY' && item.unit !== 'mca')) {
      reasons.push('PRESSURE_SUPPLY deve manter a unidade original mca.')
    }
  }

  if (source?.type === 'DMC') {
    if (!source.dmc.id || !source.dmc.active) reasons.push('Selecione um DMC ativo válido.')
    const allowed = ['PRESSURE_PC', 'PRESSURE_UPSTREAM', 'PRESSURE_DOWNSTREAM', 'FLOW']
    if (dataChannels.some((item) => !allowed.includes(item.channelType))) reasons.push('DMC aceita somente canais de pressão do PC, montante, jusante e vazão.')
    if (dataChannels.some((item) => item.channelType.startsWith('PRESSURE_') && item.unit !== 'mca')) reasons.push('Canais de pressão do DMC devem manter a unidade original mca.')
    if (dataChannels.some((item) => item.channelType === 'FLOW' && !['m3_h', 'l_s'].includes(item.unit ?? ''))) reasons.push('Confirme a unidade original da vazão como m3_h ou l_s.')
    const channelTypes = dataChannels.map((item) => item.channelType)
    if (new Set(channelTypes).size !== channelTypes.length) reasons.push('Mapeie no máximo uma coluna para cada canal do DMC.')
  }

  if (table && timestamps.length === 1 && !table.rows.some((row) => parseLocalTimestamp(row[timestamps[0].index]) !== null)) {
    reasons.push('Nenhum timestamp válido foi encontrado para gerar a prévia.')
  }
  if (table && dataChannels.length > 0 && !table.rows.some((row) => dataChannels.some((item) => parseLocaleNumber(row[item.index]) !== undefined && parseLocaleNumber(row[item.index]) !== null))) {
    reasons.push('Nenhum valor numérico válido foi encontrado nos canais mapeados.')
  }

  return { ready: reasons.length === 0, reasons }
}
