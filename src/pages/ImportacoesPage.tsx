import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FileSpreadsheet, RefreshCw, Search } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { DataState } from '../components/ui/DataState'
import { PageHeading } from '../components/ui/PageHeading'
import { useAuth } from '../features/auth/useAuth'
import { calculateCoverage, summarizeFlags } from '../features/imports/operational-summary'
import { decodeBytes, detectDelimiter, detectEncoding, parseDelimitedText, parseLocalTimestamp, parseLocaleNumber, prevalidate, sha256Hex, suggestMapping } from '../features/imports/parser'
import { getImportReadiness } from '../features/imports/readiness'
import type { ColumnMapping, Delimiter, FileEncoding, HeaderMode, ImportChannel, ImportSource, ParsedTable, PrevalidationResult } from '../features/imports/types'
import { executeImport, findExistingImport, getImportSummary, listImportSummaries } from '../services/imports.service'
import type { ImportOperationalSummary, SupplyGroup } from '../types/database.types'

type OperationalChannel = 'PRESSURE_SUPPLY' | 'FLOW'

const steps = ['Configuração', 'Mapeamento', 'Pré-validação', 'Confirmação', 'Processamento', 'Resultado']
const formatNumber = (value: number | null, digits = 2) => value === null ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits: digits })
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'

export function ImportacoesPage() {
  const { isMockMode, user } = useAuth()
  const [step, setStep] = useState(0)
  const [supplyGroup, setSupplyGroup] = useState<SupplyGroup>('REDE')
  const [channel, setChannel] = useState<OperationalChannel>('PRESSURE_SUPPLY')
  const [unit, setUnit] = useState('mca')
  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null)
  const [hash, setHash] = useState('')
  const [encoding, setEncoding] = useState<FileEncoding>('UTF-8')
  const [delimiter, setDelimiter] = useState<Delimiter>(';')
  const [headerMode, setHeaderMode] = useState<HeaderMode>('AUTO')
  const [table, setTable] = useState<ParsedTable | null>(null)
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [validation, setValidation] = useState<PrevalidationResult | null>(null)
  const [progress, setProgress] = useState({ processed: 0, total: 0 })
  const [result, setResult] = useState<ImportOperationalSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<ImportOperationalSummary[]>([])
  const [selectedHistory, setSelectedHistory] = useState<ImportOperationalSummary | null>(null)
  const [historyLoading, setHistoryLoading] = useState(!isMockMode)

  const source = useMemo<ImportSource>(() => ({ type: 'SUPPLY_OUTLET', supplyGroup }), [supplyGroup])

  const refreshHistory = useCallback(async () => {
    if (isMockMode) return
    setHistoryLoading(true)
    try { setHistory(await listImportSummaries()) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Falha ao carregar o histórico de importações.') }
    finally { setHistoryLoading(false) }
  }, [isMockMode])

  useEffect(() => { void refreshHistory() }, [refreshHistory])

  const mappingsFor = useCallback((parsed: ParsedTable, selectedChannel = channel, selectedUnit = unit) => suggestMapping(parsed.headers, null, 'PRESSURE_SUPPLY', parsed.hasHeader === true).map((mapping) => {
    if (mapping.channelType === 'TIMESTAMP') return mapping
    if (mapping.channelType === selectedChannel) return { ...mapping, unit: selectedUnit }
    return { ...mapping, channelType: 'IGNORE' as const, unit: null }
  }), [channel, unit])

  const applyTable = useCallback((parsed: ParsedTable, mode: HeaderMode) => {
    setTable(parsed); setHeaderMode(mode); setMappings(mappingsFor(parsed)); setValidation(null)
  }, [mappingsFor])

  const parseTextAgain = useCallback((nextEncoding: FileEncoding, nextDelimiter: Delimiter, nextHeaderMode: HeaderMode = headerMode) => {
    if (!bytes) return
    const text = decodeBytes(new Uint8Array(bytes), nextEncoding)
    applyTable(parseDelimitedText(text, nextDelimiter, nextEncoding, nextHeaderMode), nextHeaderMode)
  }, [applyTable, bytes, headerMode])

  function chooseChannel(nextChannel: OperationalChannel) {
    const nextUnit = nextChannel === 'PRESSURE_SUPPLY' ? 'mca' : unit === 'mca' ? '' : unit
    setChannel(nextChannel); setUnit(nextUnit); setValidation(null)
    if (table) setMappings(mappingsFor(table, nextChannel, nextUnit))
  }

  async function selectFile(selected?: File) {
    setError(null); setResult(null); setValidation(null); setTable(null); setMappings([]); setBytes(null); setHash('')
    if (!selected) { setFile(null); return }
    if (selected.name.split('.').pop()?.toLowerCase() !== 'csv') { setFile(null); setError('Formato não suportado. Selecione um arquivo CSV.'); return }
    const originalBytes = await selected.arrayBuffer()
    const detectedEncoding = detectEncoding(new Uint8Array(originalBytes))
    const text = decodeBytes(new Uint8Array(originalBytes), detectedEncoding)
    const detectedDelimiter = detectDelimiter(text)
    const detected = parseDelimitedText(text, detectedDelimiter, detectedEncoding, 'AUTO')
    const mode = detected.suggestedHeaderMode ?? 'AUTO'
    const parsed = mode === 'AUTO' ? detected : parseDelimitedText(text, detectedDelimiter, detectedEncoding, mode)
    setFile(selected); setBytes(originalBytes); setHash(await sha256Hex(originalBytes)); setEncoding(detectedEncoding); setDelimiter(detectedDelimiter); applyTable(parsed, mode)
  }

  function changeMapping(index: number, value: string) {
    setValidation(null)
    setMappings((current) => current.map((mapping) => mapping.index === index ? { ...mapping, channelType: value as ImportChannel, unit: value === channel ? unit : null } : mapping))
  }

  const preview = useMemo(() => table?.rows.slice(0, 20) ?? [], [table])
  const readiness = useMemo(() => {
    const base = getImportReadiness({ fileSelected: Boolean(file), bytesReady: Boolean(bytes), hashReady: Boolean(hash), table, source, mappings })
    const dataChannels = mappings.filter((item) => !['IGNORE', 'TIMESTAMP'].includes(item.channelType))
    const reasons = [...base.reasons]
    if (dataChannels.length !== 1 || dataChannels[0]?.channelType !== channel) reasons.push(`Mapeie exatamente uma coluna como ${channel}.`)
    if (dataChannels[0]?.unit !== unit) reasons.push('A unidade mapeada deve corresponder à unidade confirmada na configuração.')
    return { ready: reasons.length === 0, reasons: [...new Set(reasons)] }
  }, [bytes, channel, file, hash, mappings, source, table, unit])

  async function runPrevalidation() {
    if (!table || !readiness.ready) return
    setError(null)
    try {
      if (await findExistingImport(hash, source)) { setError('Este arquivo já foi importado.'); return }
      setValidation(prevalidate(table, mappings)); setStep(2)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível validar a duplicidade do arquivo.') }
  }

  async function confirmImport() {
    if (!file || !bytes || !validation || !user) return
    setStep(4); setError(null); setProgress({ processed: 0, total: validation.measurements.length })
    try {
      const imported = await executeImport({ file, bytes, hash, source, mappings, hasHeader: table?.hasHeader === true, prevalidation: validation, encoding: table?.encoding ?? encoding, delimiter: table?.delimiter ?? null, userId: user.id, onProgress: (processed, total) => setProgress({ processed, total }) })
      setResult(await getImportSummary(imported)); setStep(5); await refreshHistory()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Falha durante a importação.'
      setError(/duplicate|already|já foi importado/i.test(message) ? 'Este arquivo já foi importado.' : message)
      setStep(5); await refreshHistory()
    }
  }

  function resetWizard() {
    setStep(0); setFile(null); setBytes(null); setHash(''); setHeaderMode('AUTO'); setTable(null); setMappings([]); setValidation(null); setResult(null); setError(null); setProgress({ processed: 0, total: 0 })
  }

  return (
    <>
      <PageHeading title="Importações hidráulicas" description="Importação operacional de pressão e vazão das alimentações, preservando arquivo, RAW imutável e qualidade separada." action={<Badge tone="info">CSV · REDE · XIXOVA</Badge>} />
      <ol className="wizard-steps import-operational-steps">{steps.map((label, index) => <li key={label} className={index === step ? 'active' : index < step ? 'done' : ''}><span>{index < step ? '✓' : index + 1}</span>{label}</li>)}</ol>
      {error && <div className="import-error" role="alert">{error}</div>}
      <Card className="import-wizard">
        {step === 0 && <div className="wizard-panel"><FileSpreadsheet size={36} /><h3>1. Configure a importação</h3><div className="operational-config"><fieldset><legend>Origem</legend><strong>Saída de abastecimento</strong><small>SUPPLY_OUTLET · DMC não disponível nesta etapa</small></fieldset><fieldset><legend>Alimentação</legend><div className="button-row button-row-start"><button type="button" className={supplyGroup === 'REDE' ? 'active' : ''} onClick={() => setSupplyGroup('REDE')}>REDE</button><button type="button" className={supplyGroup === 'XIXOVA' ? 'active' : ''} onClick={() => setSupplyGroup('XIXOVA')}>XIXOVA</button></div></fieldset><fieldset><legend>Canal</legend><div className="button-row button-row-start"><button type="button" className={channel === 'PRESSURE_SUPPLY' ? 'active' : ''} onClick={() => chooseChannel('PRESSURE_SUPPLY')}>Pressão</button><button type="button" className={channel === 'FLOW' ? 'active' : ''} onClick={() => chooseChannel('FLOW')}>Vazão</button></div></fieldset><label>Unidade original{channel === 'PRESSURE_SUPPLY' ? <select value="mca" disabled><option value="mca">mca</option></select> : <select value={unit} onChange={(event) => { setUnit(event.target.value); if (table) setMappings(mappingsFor(table, channel, event.target.value)) }}><option value="">Confirmar unidade</option><option value="m3_h">m³/h</option><option value="l_s">L/s</option></select>}</label><label>Arquivo CSV<input aria-label="Arquivo hidráulico CSV" type="file" accept=".csv,text/csv" disabled={isMockMode} onChange={(event) => void selectFile(event.target.files?.[0])} /></label></div>{file && <ContextSummary file={file} supplyGroup={supplyGroup} channel={channel} unit={unit} />}{isMockMode && <p className="note">Importação disponível somente com Supabase configurado e sessão ADMIN/GESTOR.</p>}<div className="button-row"><button type="button" disabled={!file || !table || !unit} onClick={() => setStep(1)}>Continuar para mapeamento</button></div></div>}
        {step === 1 && table && <div className="wizard-panel"><h3>2. Mapeamento e prévia</h3><ContextSummary file={file} supplyGroup={supplyGroup} channel={channel} unit={unit} /><div className="parser-controls"><label>Encoding<select value={encoding} onChange={(event) => { const value = event.target.value as FileEncoding; setEncoding(value); parseTextAgain(value, delimiter) }}><option>UTF-8</option><option>WINDOWS-1252</option></select></label><label>Delimitador<select value={delimiter} onChange={(event) => { const value = event.target.value as Delimiter; setDelimiter(value); parseTextAgain(encoding, value) }}><option value=";">Ponto e vírgula (;)</option><option value=",">Vírgula (,)</option><option value={'\t'}>Tabulação</option></select></label></div><div className="header-choice"><div><strong>Cabeçalho detectado:</strong> {table.suggestedHeaderMode === 'ABSENT' ? 'Provavelmente ausente' : table.suggestedHeaderMode === 'PRESENT' ? 'Provavelmente presente' : 'Detecção ambígua'} <Badge tone={table.headerConfidence === 'HIGH' ? 'success' : 'warning'}>{table.headerConfidence}</Badge></div><label>Cabeçalho do arquivo<select value={headerMode} onChange={(event) => parseTextAgain(encoding, delimiter, event.target.value as HeaderMode)}><option value="AUTO">Detectar automaticamente</option><option value="PRESENT">Primeira linha é cabeçalho</option><option value="ABSENT">Arquivo não possui cabeçalho</option></select></label></div><div className="table-wrap"><table><thead><tr><th>Coluna</th><th>Mapear como</th><th>Unidade</th><th>Sugestão</th></tr></thead><tbody>{mappings.map((mapping) => <tr key={mapping.index}><td>{mapping.index + 1} · <strong>{mapping.displayName}</strong><small className="cell-note">{mapping.headerOriginal ?? 'Sem cabeçalho original'}</small></td><td><select value={mapping.channelType} onChange={(event) => changeMapping(mapping.index, event.target.value)}><option value="IGNORE">IGNORAR</option><option value="TIMESTAMP">TIMESTAMP</option><option value={channel}>{channel}</option></select></td><td>{mapping.channelType === channel ? unit : '—'}</td><td><Badge tone={mapping.confidence === 'HIGH' ? 'success' : mapping.confidence === 'MEDIUM' ? 'warning' : 'neutral'}>{mapping.confidence}</Badge></td></tr>)}</tbody></table></div><h4>Primeiras {preview.length} linhas interpretadas</h4><div className="table-wrap preview-table"><table><thead><tr><th>Linha</th>{table.headers.map((header, index) => <th key={`${index}-${header}`}>{header}</th>)}</tr></thead><tbody>{preview.map((row, rowIndex) => <tr key={rowIndex}><td>{rowIndex + (table.hasHeader ? 2 : 1)}</td>{row.map((value, columnIndex) => { const mapping = mappings[columnIndex]; return <td key={columnIndex}><span>{String(value ?? '')}</span>{mapping?.channelType === 'TIMESTAMP' && <small className="cell-note">{parseLocalTimestamp(value) ?? 'TIMESTAMP INVÁLIDO'}</small>}{mapping?.channelType === channel && <small className="cell-note">numérico: {String(parseLocaleNumber(value) ?? 'NULL/ERRO')}</small>}</td>})}</tr>)}</tbody></table></div>{!readiness.ready && <div className="note" role="status"><strong>Para habilitar a pré-validação:</strong><ul>{readiness.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}<div className="button-row"><button type="button" className="secondary-button" onClick={() => setStep(0)}>Voltar</button><button type="button" disabled={!readiness.ready} onClick={() => void runPrevalidation()}>Pré-validar arquivo</button></div></div>}
        {step === 2 && validation && <div className="wizard-panel"><h3>3. Pré-validação</h3><ContextSummary file={file} supplyGroup={supplyGroup} channel={channel} unit={unit} /><PrevalidationMetrics value={validation} unit={unit} /><div className="note">Warnings e gaps são registrados separadamente. Nenhum timestamp é criado, nenhum gap é preenchido e nenhum valor é excluído automaticamente.</div><div className="button-row"><button type="button" className="secondary-button" onClick={() => setStep(1)}>Revisar mapeamento</button><button type="button" onClick={() => setStep(3)}>Continuar para confirmação</button></div></div>}
        {step === 3 && validation && <div className="wizard-panel"><h3>4. Confirmação final</h3><ContextSummary file={file} supplyGroup={supplyGroup} channel={channel} unit={unit} /><PrevalidationMetrics value={validation} unit={unit} /><label className="confirmation-box"><input type="checkbox" required id="raw-confirm" /> Confirmo que revisei arquivo, origem, alimentação, canal, unidade, timestamps, warnings e rejeições.</label><button type="button" className="danger-confirm" onClick={() => { const checkbox = document.querySelector<HTMLInputElement>('#raw-confirm'); if (checkbox?.checked) void confirmImport(); else setError('Marque a confirmação de revisão antes de importar.') }}>Confirmar importação RAW</button></div>}
        {step === 4 && <div className="wizard-panel"><RefreshCw className="spin" /><h3>5. Processamento em lotes</h3><progress value={progress.processed} max={progress.total || 1} /><strong>{progress.processed.toLocaleString('pt-BR')} / {progress.total.toLocaleString('pt-BR')} medições processadas</strong><p className="desc">O arquivo original é preservado no bucket privado sem sobrescrita. RAW já confirmado permanece imutável.</p></div>}
        {step === 5 && <div className="wizard-panel">{result ? <><CheckCircle2 className="good" size={40} /><h3>6. Importação concluída</h3><ImportMetrics summary={result} /></> : <><h3>Importação não concluída</h3><p className="desc">Nenhuma nova tentativa automática será realizada. Consulte o erro e o histórico antes de tentar novamente.</p></>}<button type="button" onClick={resetWizard}>Nova importação</button></div>}
      </Card>
      <Card><h3>Histórico de importações</h3>{historyLoading ? <DataState loading error={null} empty="" /> : history.length === 0 ? <div className="table-empty">Nenhuma importação registrada</div> : <div className="table-wrap"><table><thead><tr><th>Data da importação</th><th>Arquivo</th><th>Alimentação</th><th>Canal</th><th>Período</th><th>RAW</th><th>Cobertura</th><th>Status</th><th>Detalhes</th></tr></thead><tbody>{history.map((summary) => <tr key={summary.import.id}><td>{formatDate(summary.import.imported_at)}</td><td>{summary.import.original_filename}</td><td>{summary.import.supply_group}</td><td>{summary.channelType}</td><td>{formatDate(summary.firstReading)} → {formatDate(summary.lastReading)}</td><td>{summary.rawCount.toLocaleString('pt-BR')}</td><td>{summary.coveragePercent === null ? '—' : `${formatNumber(summary.coveragePercent)}%`}</td><td><Badge tone={summary.import.status === 'COMPLETED' ? 'success' : summary.import.status === 'FAILED' ? 'danger' : 'warning'}>{summary.import.status}</Badge></td><td><button type="button" className="secondary-button inline-button" onClick={() => setSelectedHistory(summary)}><Search size={15} /> Consultar</button></td></tr>)}</tbody></table></div>}</Card>
      {selectedHistory && <Card className="import-history-detail"><div className="section-title"><div><h3>Detalhes da importação</h3><p className="desc">Consulta somente leitura. RAW não pode ser editado nem excluído.</p></div><button type="button" className="secondary-button" onClick={() => setSelectedHistory(null)}>Fechar</button></div><ImportMetrics summary={selectedHistory} /></Card>}
    </>
  )
}

function ContextSummary({ file, supplyGroup, channel, unit }: { file: File | null; supplyGroup: SupplyGroup; channel: OperationalChannel; unit: string }) {
  return <dl className="validation-grid context-grid"><div><dt>Arquivo</dt><dd>{file?.name ?? '—'}</dd></div><div><dt>Origem</dt><dd>SUPPLY_OUTLET</dd></div><div><dt>Alimentação</dt><dd>{supplyGroup}</dd></div><div><dt>Canal</dt><dd>{channel}</dd></div><div><dt>Unidade RAW</dt><dd>{unit || '—'}</dd></div></dl>
}

function PrevalidationMetrics({ value, unit }: { value: PrevalidationResult; unit: string }) {
  const numeric = value.measurements.map((item) => item.rawValue).filter((item): item is number => item !== null)
  const quality = summarizeFlags(value.flags.map((flag) => ({ flag_type: flag.flagType, severity: flag.severity, details: flag.details })))
  const coverage = calculateCoverage(value.firstReading, value.lastReading, value.predominantCadenceMinutes, value.measurements.length)
  const items = [['Status', value.invalidTimestampCount === 0 && value.numericParseErrorCount === 0 ? 'Pronto para importar' : 'Com rejeições/warnings'], ['Período', `${formatDate(value.firstReading)} → ${formatDate(value.lastReading)}`], ['Linhas', value.sourceRowCount.toLocaleString('pt-BR')], ['RAW previsto', value.measurements.length.toLocaleString('pt-BR')], ['Unidade', unit], ['Mínimo', numeric.length ? `${formatNumber(Math.min(...numeric))} ${unit}` : '—'], ['Máximo', numeric.length ? `${formatNumber(Math.max(...numeric))} ${unit}` : '—'], ['Flags', quality.total.toLocaleString('pt-BR')], ['Gaps', `${quality.gaps} · ${quality.missingTimestamps.toLocaleString('pt-BR')} ausências estimadas`], ['Cobertura', coverage === null ? '—' : `${formatNumber(coverage)}%`], ['Rejeições', value.rejectedRows.length.toLocaleString('pt-BR')], ['Erros de parsing', value.numericParseErrorCount.toLocaleString('pt-BR')]]
  return <><dl className="validation-grid">{items.map(([label, content]) => <div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}</dl>{quality.breakdown.length > 0 && <div className="quality-breakdown"><strong>Warnings/flags previstos</strong>{quality.breakdown.map((flag) => <Badge key={`${flag.type}-${flag.severity}`} tone="warning">{flag.type}: {flag.count} · {flag.severity}</Badge>)}</div>}</>
}

function ImportMetrics({ summary }: { summary: ImportOperationalSummary }) {
  const items = [['Status', summary.import.status], ['Arquivo', summary.import.original_filename], ['Origem', summary.import.source_type], ['Alimentação', summary.import.supply_group ?? '—'], ['Canal', summary.channelType], ['Período', `${formatDate(summary.firstReading)} → ${formatDate(summary.lastReading)}`], ['Linhas', summary.import.row_count.toLocaleString('pt-BR')], ['RAW criado', summary.rawCount.toLocaleString('pt-BR')], ['Unidade', `${summary.rawUnit}${summary.normalizedUnit ? ` → ${summary.normalizedUnit}` : ''}`], ['Mínimo', `${formatNumber(summary.minimum)} ${summary.rawUnit}`], ['Máximo', `${formatNumber(summary.maximum)} ${summary.rawUnit}`], ['Flags', summary.flags.toLocaleString('pt-BR')], ['Gaps', `${summary.gaps} · ${summary.missingTimestamps.toLocaleString('pt-BR')} ausências estimadas`], ['Cobertura', summary.coveragePercent === null ? '—' : `${formatNumber(summary.coveragePercent)}%`], ['Rejeições', summary.rejections.toLocaleString('pt-BR')], ['Import ID', summary.import.id]]
  return <><dl className="result-grid">{items.map(([label, content]) => <div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}</dl>{summary.flagBreakdown.length > 0 && <div className="quality-breakdown"><strong>Flags registradas</strong>{summary.flagBreakdown.map((flag) => <Badge key={`${flag.type}-${flag.severity}`} tone="warning">{flag.type}: {flag.count} · {flag.severity}</Badge>)}</div>}</>
}

export default ImportacoesPage
