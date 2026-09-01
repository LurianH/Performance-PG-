import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { DataState } from '../components/ui/DataState'
import { PageHeading } from '../components/ui/PageHeading'
import { useAuth } from '../features/auth/useAuth'
import { decodeBytes, detectDelimiter, detectEncoding, parseDelimitedText, parseLocalTimestamp, parseLocaleNumber, parseXlsxFile, prevalidate, sha256Hex, suggestMapping } from '../features/imports/parser'
import { getImportReadiness } from '../features/imports/readiness'
import type { ColumnMapping, Delimiter, FileEncoding, HeaderMode, ImportChannel, ImportSource, ParsedTable, PrevalidationResult } from '../features/imports/types'
import { useDmcs } from '../hooks/useReferenceData'
import { executeImport, listImports, requestReprocessing } from '../services/imports.service'
import type { DataImportRow, SupplyGroup } from '../types/database.types'

const steps = ['Arquivo', 'Origem', 'Mapeamento', 'Pré-validação', 'Confirmação', 'Processamento', 'Resultado']
const channels: ImportChannel[] = ['IGNORE', 'TIMESTAMP', 'PRESSURE_PC', 'PRESSURE_UPSTREAM', 'PRESSURE_DOWNSTREAM', 'PRESSURE_SUPPLY', 'FLOW', 'OTHER']

export function ImportacoesPage() {
  const { isMockMode, user } = useAuth()
  const dmcs = useDmcs()
  const [step, setStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null)
  const [hash, setHash] = useState('')
  const [encoding, setEncoding] = useState<FileEncoding>('UTF-8')
  const [delimiter, setDelimiter] = useState<Delimiter>(';')
  const [headerMode, setHeaderMode] = useState<HeaderMode>('AUTO')
  const [table, setTable] = useState<ParsedTable | null>(null)
  const [source, setSource] = useState<ImportSource | null>(null)
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [validation, setValidation] = useState<PrevalidationResult | null>(null)
  const [progress, setProgress] = useState({ processed: 0, total: 0 })
  const [result, setResult] = useState<DataImportRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<DataImportRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(!isMockMode)

  const refreshHistory = useCallback(async () => {
    if (isMockMode) return
    setHistoryLoading(true)
    try { setHistory(await listImports()) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Falha ao carregar histórico') } finally { setHistoryLoading(false) }
  }, [isMockMode])

  useEffect(() => { void refreshHistory() }, [refreshHistory])

  const applyTable = useCallback((parsed: ParsedTable, mode: HeaderMode) => {
    setTable(parsed)
    setHeaderMode(mode)
    setMappings(suggestMapping(parsed.headers, source?.type === 'DMC' ? source.dmc.pc_channel : null, source?.type === 'SUPPLY_OUTLET' ? 'PRESSURE_SUPPLY' : 'PRESSURE_PC', parsed.hasHeader === true))
    setValidation(null)
  }, [source])

  const parseTextAgain = useCallback((nextEncoding: FileEncoding, nextDelimiter: Delimiter, nextHeaderMode: HeaderMode = headerMode) => {
    if (!bytes || file?.name.toLowerCase().endsWith('.xlsx')) return
    const text = decodeBytes(new Uint8Array(bytes), nextEncoding)
    applyTable(parseDelimitedText(text, nextDelimiter, nextEncoding, nextHeaderMode), nextHeaderMode)
  }, [applyTable, bytes, file, headerMode])

  async function changeHeaderMode(nextHeaderMode: HeaderMode) {
    if (!file || !bytes) return
    if (file.name.toLowerCase().endsWith('.xlsx')) applyTable(await parseXlsxFile(file, nextHeaderMode), nextHeaderMode)
    else parseTextAgain(encoding, delimiter, nextHeaderMode)
  }

  async function selectFile(selected?: File) {
    if (!selected) return
    setError(null); setFile(selected); setResult(null); setValidation(null)
    const originalBytes = await selected.arrayBuffer()
    setBytes(originalBytes); setHash(await sha256Hex(originalBytes))
    const extension = selected.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'txt', 'xlsx'].includes(extension ?? '')) { setError('Formato não suportado. Use TXT, CSV ou XLSX.'); return }
    if (extension === 'xlsx') {
      const detected = await parseXlsxFile(selected, 'AUTO')
      const mode = detected.suggestedHeaderMode ?? 'AUTO'
      applyTable(mode === 'AUTO' ? detected : await parseXlsxFile(selected, mode), mode); setStep(1); return
    }
    const detectedEncoding = detectEncoding(new Uint8Array(originalBytes))
    const text = decodeBytes(new Uint8Array(originalBytes), detectedEncoding)
    const detectedDelimiter = detectDelimiter(text)
    const detected = parseDelimitedText(text, detectedDelimiter, detectedEncoding, 'AUTO')
    const mode = detected.suggestedHeaderMode ?? 'AUTO'
    const parsed = mode === 'AUTO' ? detected : parseDelimitedText(text, detectedDelimiter, detectedEncoding, mode)
    setEncoding(detectedEncoding); setDelimiter(detectedDelimiter); applyTable(parsed, mode); setStep(1)
  }

  function chooseDmc(id: string) {
    const dmc = dmcs.data.find((item) => item.id === id)
    if (!dmc || !table) return
    setSource({ type: 'DMC', dmc }); setMappings(suggestMapping(table.headers, dmc.pc_channel, 'PRESSURE_PC', table.hasHeader === true))
  }

  function chooseSupply(supplyGroup: SupplyGroup) {
    setSource({ type: 'SUPPLY_OUTLET', supplyGroup })
    if (table) setMappings(suggestMapping(table.headers, null, 'PRESSURE_SUPPLY', table.hasHeader === true))
  }
  function changeMapping(index: number, field: 'channelType' | 'unit', value: string) {
    setMappings((current) => current.map((mapping) => {
      if (mapping.index !== index) return mapping
      if (field === 'unit') return { ...mapping, unit: value }
      const channelType = value as ImportChannel
      const unit = ['IGNORE', 'TIMESTAMP'].includes(channelType) ? null : channelType.startsWith('PRESSURE_') ? (mapping.unit ?? 'mca') : mapping.unit
      return { ...mapping, channelType, unit }
    }))
  }

  const preview = useMemo(() => table?.rows.slice(0, 20) ?? [], [table])
  const readiness = useMemo(() => getImportReadiness({ fileSelected: Boolean(file), bytesReady: Boolean(bytes), hashReady: Boolean(hash), table, source, mappings }), [bytes, file, hash, mappings, source, table])
  const canPrevalidate = readiness.ready

  function runPrevalidation() {
    if (!table || !canPrevalidate) return
    const checked = prevalidate(table, mappings); setValidation(checked); setStep(3)
  }

  async function confirmImport() {
    if (!file || !bytes || !source || !validation || !user) return
    setStep(5); setError(null); setProgress({ processed: 0, total: validation.measurements.length })
    try {
      const imported = await executeImport({ file, bytes, hash, source, mappings, hasHeader: table?.hasHeader === true, prevalidation: validation, encoding: table?.encoding ?? encoding, delimiter: table?.delimiter ?? null, userId: user.id, onProgress: (processed, total) => setProgress({ processed, total }) })
      setResult(imported); setStep(6); await refreshHistory()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Falha durante a importação'); setStep(6); await refreshHistory() }
  }

  function resetWizard() { setStep(0); setFile(null); setBytes(null); setHash(''); setHeaderMode('AUTO'); setTable(null); setSource(null); setMappings([]); setValidation(null); setResult(null); setError(null) }

  return (
    <>
      <PageHeading title="Importações RAW" description="Fluxo revisável para preservar o arquivo original e inserir medições hidráulicas sem cálculos de CPE, IAL ou IPS." action={<Badge tone="info">TXT · CSV · XLSX</Badge>} />
      <ol className="wizard-steps">{steps.map((label, index) => <li key={label} className={index === step ? 'active' : index < step ? 'done' : ''}><span>{index < step ? '✓' : index + 1}</span>{label}</li>)}</ol>
      {error && <div className="import-error" role="alert">{error}</div>}
      <Card className="import-wizard">
        {step === 0 && <div className="wizard-panel"><FileSpreadsheet size={36} /><h3>1. Selecione o arquivo</h3><p className="desc">Os bytes originais serão usados no hash e preservados sem conversão.</p><input aria-label="Arquivo hidráulico" type="file" accept=".txt,.csv,.xlsx" disabled={isMockMode} onChange={(event) => void selectFile(event.target.files?.[0])} />{isMockMode && <p className="note">Importação disponível somente com Supabase configurado e sessão ADMIN/GESTOR.</p>}</div>}
        {step === 1 && <div className="wizard-panel"><h3>2. Origem da série</h3><div className="origin-grid"><label><input type="radio" checked={source?.type === 'DMC'} onChange={() => source?.type !== 'DMC' && setSource(null)} /> DMC</label><select value={source?.type === 'DMC' ? source.dmc.id : ''} onChange={(event) => chooseDmc(event.target.value)}><option value="">Selecione um dos 14 DMCs</option>{dmcs.data.map((dmc) => <option key={dmc.id} value={dmc.id}>{dmc.name} · {dmc.supply_group}</option>)}</select><label><input type="radio" checked={source?.type === 'SUPPLY_OUTLET'} onChange={() => chooseSupply('REDE')} /> Saída do reservatório</label><div className="button-row"><button type="button" className={source?.type === 'SUPPLY_OUTLET' && source.supplyGroup === 'REDE' ? 'active' : ''} onClick={() => chooseSupply('REDE')}>REDE</button><button type="button" className={source?.type === 'SUPPLY_OUTLET' && source.supplyGroup === 'XIXOVA' ? 'active' : ''} onClick={() => chooseSupply('XIXOVA')}>XIXOVA</button></div></div><div className="button-row"><button type="button" className="secondary-button" onClick={resetWizard}>Cancelar</button><button type="button" disabled={!source} onClick={() => setStep(2)}>Continuar para mapeamento</button></div></div>}
        {step === 2 && table && <div className="wizard-panel"><h3>3. Mapeamento e prévia</h3>{table.encoding !== 'XLSX' && <div className="parser-controls"><label>Encoding<select value={encoding} onChange={(event) => { const value = event.target.value as FileEncoding; setEncoding(value); parseTextAgain(value, delimiter) }}><option>UTF-8</option><option>WINDOWS-1252</option></select></label><label>Delimitador<select value={delimiter} onChange={(event) => { const value = event.target.value as Delimiter; setDelimiter(value); parseTextAgain(encoding, value) }}><option value=";">Ponto e vírgula (;)</option><option value=",">Vírgula (,)</option><option value={'\t'}>Tabulação</option></select></label></div>}<div className="header-choice"><div><strong>Cabeçalho detectado:</strong> {table.suggestedHeaderMode === 'ABSENT' ? 'Provavelmente não possui cabeçalho' : table.suggestedHeaderMode === 'PRESENT' ? 'Provavelmente possui cabeçalho' : 'Detecção ambígua'} <Badge tone={table.headerConfidence === 'HIGH' ? 'success' : 'warning'}>{table.headerConfidence}</Badge></div><label>Cabeçalho do arquivo<select value={headerMode} onChange={(event) => void changeHeaderMode(event.target.value as HeaderMode)}><option value="AUTO">Detectar automaticamente</option><option value="PRESENT">Primeira linha é cabeçalho</option><option value="ABSENT">Arquivo não possui cabeçalho</option></select></label><div><strong>Opção selecionada:</strong> {headerMode === 'ABSENT' ? 'Arquivo não possui cabeçalho' : headerMode === 'PRESENT' ? 'Primeira linha é cabeçalho' : 'Detectar automaticamente'}</div><div><strong>Cabeçalho:</strong> {table.hasHeader ? 'Possui' : table.hasHeader === false ? 'Não possui' : 'Confirmação necessária'}</div></div><div className="table-wrap"><table><thead><tr><th>Posição / cabeçalho original</th><th>Mapear como</th><th>Unidade</th><th>Sugestão</th></tr></thead><tbody>{mappings.map((mapping) => <tr key={mapping.index}><td>{mapping.index} · <strong>{mapping.displayName}</strong><small className="cell-note">{mapping.headerOriginal ?? 'Sem cabeçalho original'}</small></td><td><select value={mapping.channelType} onChange={(event) => changeMapping(mapping.index, 'channelType', event.target.value)}>{channels.map((channel) => <option key={channel}>{channel}</option>)}</select></td><td>{!['IGNORE', 'TIMESTAMP'].includes(mapping.channelType) ? <select value={mapping.unit ?? ''} onChange={(event) => changeMapping(mapping.index, 'unit', event.target.value)}><option value="">Confirmar unidade</option><option value="mca">mca</option><option value="m3_h">m3_h</option><option value="l_s">l_s</option><option value="raw">raw</option></select> : '—'}</td><td><Badge tone={mapping.confidence === 'HIGH' ? 'success' : mapping.confidence === 'MEDIUM' ? 'warning' : 'neutral'}>{mapping.confidence}</Badge></td></tr>)}</tbody></table></div><h4>Primeiras {preview.length} linhas interpretadas</h4><div className="table-wrap preview-table"><table><thead><tr><th>Linha</th>{table.headers.map((header, index) => <th key={`${index}-${header}`}>{header}</th>)}</tr></thead><tbody>{preview.map((row, rowIndex) => <tr key={rowIndex}><td>{rowIndex + (table.hasHeader ? 2 : 1)}</td>{row.map((value, columnIndex) => { const mapping = mappings[columnIndex]; return <td key={columnIndex}><span>{value instanceof Date ? value.toISOString() : String(value ?? '')}</span>{mapping?.channelType === 'TIMESTAMP' && <small className="cell-note">{parseLocalTimestamp(value) ?? 'TIMESTAMP INVÁLIDO'}</small>}{mapping && !['IGNORE', 'TIMESTAMP'].includes(mapping.channelType) && <small className="cell-note">numérico: {String(parseLocaleNumber(value) ?? 'NULL/ERRO')}</small>}</td>})}</tr>)}</tbody></table></div>{!canPrevalidate && <div className="note" role="status"><strong>Para habilitar a pré-validação:</strong><ul>{readiness.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}<div className="button-row"><button type="button" className="secondary-button" onClick={() => setStep(1)}>Voltar</button><button type="button" disabled={!canPrevalidate} onClick={runPrevalidation}>Pré-validar arquivo</button></div></div>}
        {step === 3 && validation && <div className="wizard-panel"><h3>4. Pré-validação</h3><ValidationSummary value={validation} file={file} hash={hash} /><div className="note">Nenhuma pressão foi classificada. Nenhum timestamp, gap ou zero foi inventado ou preenchido.</div><div className="button-row"><button type="button" className="secondary-button" onClick={() => setStep(2)}>Revisar mapeamento</button><button type="button" onClick={() => setStep(4)}>Continuar para confirmação</button></div></div>}
        {step === 4 && validation && <div className="wizard-panel"><h3>5. Confirmação final</h3><ValidationSummary value={validation} file={file} hash={hash} /><label className="confirmation-box"><input type="checkbox" required id="raw-confirm" /> Confirmo que revisei origem, mapeamento, unidades, timestamps, rejeições e contagem prevista.</label><button type="button" className="danger-confirm" onClick={() => { const checkbox = document.querySelector<HTMLInputElement>('#raw-confirm'); if (checkbox?.checked) void confirmImport(); else setError('Marque a confirmação de revisão antes de importar.') }}>Confirmar importação RAW</button></div>}
        {step === 5 && <div className="wizard-panel"><RefreshCw className="spin" /><h3>6. Processamento em lotes</h3><progress value={progress.processed} max={progress.total || 1} /><strong>{progress.processed.toLocaleString('pt-BR')} / {progress.total.toLocaleString('pt-BR')} medições processadas</strong><p className="desc">Interromper a sessão impede novos lotes, mas RAW já confirmado permanece imutável.</p></div>}
        {step === 6 && <div className="wizard-panel">{result ? <><CheckCircle2 className="good" size={40} /><h3>7. Importação concluída</h3><dl className="result-grid"><div><dt>Status</dt><dd>{result.status}</dd></div><div><dt>Arquivo</dt><dd>{result.original_filename}</dd></div><div><dt>Linhas</dt><dd>{result.row_count}</dd></div><div><dt>Rejeições</dt><dd>{result.rejected_count}</dd></div><div><dt>Hash</dt><dd>{result.file_hash.slice(0, 12)}…</dd></div><div><dt>Import ID</dt><dd>{result.id}</dd></div></dl></> : <><h3>Processamento não concluído</h3><p className="desc">O estado local foi preservado. Consulte o erro e o histórico antes de solicitar reprocessamento.</p></>}<button type="button" onClick={resetWizard}>Nova importação</button></div>}
      </Card>
      <Card><h3>Histórico de importações</h3>{historyLoading ? <DataState loading error={null} empty="" /> : history.length === 0 ? <div className="table-empty">Nenhuma importação registrada</div> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Arquivo</th><th>Origem</th><th>Status</th><th>Linhas</th><th>Rejeitados</th><th>Usuário</th><th>Ações</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{new Date(item.imported_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td><td>{item.original_filename}</td><td>{item.source_type === 'DMC' ? `DMC ${item.dmc_id?.slice(0, 8)}…` : `Saída ${item.supply_group}`}</td><td><Badge tone={item.status === 'COMPLETED' ? 'success' : item.status === 'FAILED' ? 'danger' : 'warning'}>{item.status}</Badge></td><td>{item.row_count}</td><td>{item.rejected_count}</td><td>{item.imported_by?.slice(0, 8)}…</td><td><button type="button" className="secondary-button inline-button" onClick={() => user && void requestReprocessing(item, user.id).then(refreshHistory).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Falha no reprocessamento'))}>Reprocessar</button></td></tr>)}</tbody></table></div>}</Card>
    </>
  )
}

function ValidationSummary({ value, file, hash }: { value: PrevalidationResult; file: File | null; hash: string }) {
  const items = [['Arquivo', file?.name ?? '—'], ['SHA-256', `${hash.slice(0, 16)}…`], ['Linhas físicas', value.physicalRowCount], ['Linhas de dados', value.sourceRowCount], ['Timestamps válidos', value.validTimestampCount], ['Timestamps inválidos', value.invalidTimestampCount], ['Canais mapeados', value.mappedChannelCount], ['Medições RAW previstas', value.measurements.length], ['Valores válidos', value.validNumericCount], ['Nulos', value.nullValueCount], ['Erros numéricos', value.numericParseErrorCount], ['Duplicidades', value.duplicateCount], ['Cadência predominante', value.predominantCadenceMinutes ? `${value.predominantCadenceMinutes} min` : 'Não detectada'], ['Gaps', value.gapCount], ['Maior gap', value.largestGapMinutes ? `${value.largestGapMinutes} min` : '—'], ['Primeira leitura', value.firstReading ?? '—'], ['Última leitura', value.lastReading ?? '—']]
  return <dl className="validation-grid">{items.map(([label, content]) => <div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}</dl>
}

export default ImportacoesPage
