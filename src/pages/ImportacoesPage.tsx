import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FileSpreadsheet, RefreshCw, Search } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { DataState } from '../components/ui/DataState'
import { PageHeading } from '../components/ui/PageHeading'
import { useAuth } from '../features/auth/useAuth'
import { formatImportDecimal, summarizeFlags, summarizePrevalidationChannels } from '../features/imports/operational-summary'
import { decodeBytes, detectDelimiter, detectEncoding, parseDelimitedText, parseLocalTimestamp, parseLocaleNumber, prevalidateDelimitedText, sha256Hex, suggestMapping } from '../features/imports/parser'
import { getImportReadiness, mappingChannelOptions } from '../features/imports/readiness'
import type { ColumnMapping, Delimiter, FileEncoding, HeaderMode, ImportChannel, ImportSource, ParsedTable, PrevalidationResult } from '../features/imports/types'
import { useDmcs } from '../hooks/useReferenceData'
import { executeImport, findExistingImport, getImportSummary, listImportSummaries } from '../services/imports.service'
import type { DataImportRow, ImportOperationalSummary, SupplyGroup } from '../types/database.types'

type SourceMode = 'SUPPLY_OUTLET' | 'DMC'
type OperationalChannel = 'PRESSURE_SUPPLY' | 'FLOW'
const CHANNEL_LABELS: Record<string, string> = { PRESSURE_SUPPLY: 'Pressão da alimentação', PRESSURE_PC: 'Pressão PC', PRESSURE_UPSTREAM: 'Pressão montante', PRESSURE_DOWNSTREAM: 'Pressão jusante', FLOW: 'Vazão' }
const STEPS = ['Configuração', 'Mapeamento', 'Pré-validação', 'Confirmação', 'Processamento', 'Resultado']
const formatNumber = (value: number | null) => formatImportDecimal(value, 2)
const formatRawNumber = (value: number | null) => formatImportDecimal(value)
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'
const isDataChannel = (channel: ImportChannel) => !['IGNORE', 'TIMESTAMP'].includes(channel)
const defaultUnit = (channel: ImportChannel) => channel.startsWith('PRESSURE_') ? 'mca' : channel === 'FLOW' ? 'm3_h' : null

export function ImportacoesPage() {
  const { isMockMode, user } = useAuth()
  const dmcsQuery = useDmcs()
  const activeDmcs = useMemo(() => dmcsQuery.data.filter((dmc) => dmc.active), [dmcsQuery.data])
  const [step, setStep] = useState(0)
  const [sourceMode, setSourceMode] = useState<SourceMode>('SUPPLY_OUTLET')
  const [supplyGroup, setSupplyGroup] = useState<SupplyGroup>('REDE')
  const [selectedDmcId, setSelectedDmcId] = useState('')
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
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false)

  const selectedDmc = activeDmcs.find((dmc) => dmc.id === selectedDmcId) ?? null
  const source = useMemo<ImportSource | null>(() => sourceMode === 'DMC' ? selectedDmc ? { type: 'DMC', dmc: selectedDmc } : null : { type: 'SUPPLY_OUTLET', supplyGroup }, [selectedDmc, sourceMode, supplyGroup])
  const dmcNames = useMemo(() => new Map(dmcsQuery.data.map((dmc) => [dmc.id, dmc.name])), [dmcsQuery.data])

  const refreshHistory = useCallback(async () => {
    if (isMockMode) return
    setHistoryLoading(true)
    try { setHistory(await listImportSummaries()) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Falha ao carregar o histórico.') } finally { setHistoryLoading(false) }
  }, [isMockMode])
  const openHistoryDetail = useCallback(async (item: DataImportRow) => {
    setSelectedHistory(null); setHistoryDetailLoading(true); setError(null)
    try { setSelectedHistory(await getImportSummary(item)) }
    catch { setError('Falha ao carregar os detalhes da importação.') }
    finally { setHistoryDetailLoading(false) }
  }, [])
  useEffect(() => { void refreshHistory() }, [refreshHistory])

  const mappingsFor = useCallback((parsed: ParsedTable, selectedChannel = channel, selectedUnit = unit) => {
    const isDmc = source?.type === 'DMC'
    const suggested = suggestMapping(parsed.headers, isDmc ? source.dmc.pc_channel : null, isDmc ? 'PRESSURE_PC' : 'PRESSURE_SUPPLY', parsed.hasHeader === true)
    if (isDmc) return suggested.map((item) => mappingChannelOptions('DMC').includes(item.channelType) && isDataChannel(item.channelType) ? { ...item, unit: defaultUnit(item.channelType) } : item)
    return suggested.map((item) => item.channelType === 'TIMESTAMP' ? item : item.channelType === selectedChannel ? { ...item, unit: selectedUnit } : { ...item, channelType: 'IGNORE' as const, unit: null })
  }, [channel, source, unit])

  const applyTable = useCallback((parsed: ParsedTable, mode: HeaderMode) => { setTable(parsed); setHeaderMode(mode); setMappings(mappingsFor(parsed)); setValidation(null) }, [mappingsFor])
  const parseAgain = useCallback((nextEncoding: FileEncoding, nextDelimiter: Delimiter, nextHeaderMode: HeaderMode = headerMode) => {
    if (!bytes) return
    applyTable(parseDelimitedText(decodeBytes(new Uint8Array(bytes), nextEncoding), nextDelimiter, nextEncoding, nextHeaderMode), nextHeaderMode)
  }, [applyTable, bytes, headerMode])

  function clearFile() { setFile(null); setBytes(null); setHash(''); setTable(null); setMappings([]); setValidation(null); setResult(null); setError(null) }
  function chooseSource(next: SourceMode) { setSourceMode(next); setSelectedDmcId(''); setStep(0); clearFile() }
  function chooseChannel(next: OperationalChannel) {
    const nextUnit = next === 'PRESSURE_SUPPLY' ? 'mca' : unit === 'mca' ? '' : unit
    setChannel(next); setUnit(nextUnit); setValidation(null)
    if (table) setMappings(mappingsFor(table, next, nextUnit))
  }
  function chooseSupplyUnit(nextUnit: string) { setUnit(nextUnit); setValidation(null); if (table) setMappings(mappingsFor(table, channel, nextUnit)) }
  async function selectFile(selected?: File) {
    clearFile()
    if (!selected) return
    if (selected.name.split('.').pop()?.toLowerCase() !== 'csv') { setError('Formato não suportado. Selecione um arquivo CSV.'); return }
    const originalBytes = await selected.arrayBuffer()
    const detectedEncoding = detectEncoding(new Uint8Array(originalBytes))
    const text = decodeBytes(new Uint8Array(originalBytes), detectedEncoding)
    const detectedDelimiter = detectDelimiter(text)
    const detected = parseDelimitedText(text, detectedDelimiter, detectedEncoding, 'AUTO')
    const mode = detected.suggestedHeaderMode ?? 'AUTO'
    const parsed = mode === 'AUTO' ? detected : parseDelimitedText(text, detectedDelimiter, detectedEncoding, mode)
    setFile(selected); setBytes(originalBytes); setHash(await sha256Hex(originalBytes)); setEncoding(detectedEncoding); setDelimiter(detectedDelimiter); applyTable(parsed, mode)
  }
  function changeMapping(index: number, next: ImportChannel) {
    setValidation(null)
    setMappings((current) => current.map((item) => item.index === index ? { ...item, channelType: next, unit: source?.type === 'DMC' ? defaultUnit(next) : next === channel ? unit : null } : item))
  }
  function changeUnit(index: number, next: string) { setValidation(null); setMappings((current) => current.map((item) => item.index === index ? { ...item, unit: next || null } : item)) }

  const preview = useMemo(() => table?.rows.slice(0, 20) ?? [], [table])
  const readiness = useMemo(() => {
    const base = getImportReadiness({ fileSelected: Boolean(file), bytesReady: Boolean(bytes), hashReady: Boolean(hash), table, source, mappings })
    if (source?.type === 'DMC') return base
    const data = mappings.filter((item) => isDataChannel(item.channelType))
    const reasons = [...base.reasons]
    if (data.length !== 1 || data[0]?.channelType !== channel) reasons.push(`Mapeie exatamente uma coluna como ${channel}.`)
    if (data[0]?.unit !== unit) reasons.push('A unidade mapeada deve corresponder à unidade confirmada.')
    return { ready: reasons.length === 0, reasons: [...new Set(reasons)] }
  }, [bytes, channel, file, hash, mappings, source, table, unit])

  async function runPrevalidation() {
    if (!table || !bytes || !source || !readiness.ready) return
    setError(null)
    try {
      if (await findExistingImport(hash, source)) { setError('Este arquivo já foi importado.'); return }
      const latest = prevalidateDelimitedText(decodeBytes(new Uint8Array(bytes), encoding), delimiter, encoding, headerMode, mappings)
      setTable(latest.table)
      setValidation(latest.result)
      setStep(2)
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível validar a duplicidade.') }
  }
  async function confirmImport() {
    if (!file || !bytes || !validation || !user || !source) return
    setStep(4); setError(null); setProgress({ processed: 0, total: validation.measurements.length })
    try {
      const imported = await executeImport({ file, bytes, hash, source, mappings, hasHeader: table?.hasHeader === true, prevalidation: validation, encoding: table?.encoding ?? encoding, delimiter: table?.delimiter ?? null, userId: user.id, onProgress: (processed, total) => setProgress({ processed, total }) })
      setResult(await getImportSummary(imported)); setStep(5); await refreshHistory()
    } catch (caught) { const message = caught instanceof Error ? caught.message : 'Falha durante a importação.'; setError(/duplicate|already|já foi importado/i.test(message) ? 'Este arquivo já foi importado.' : message); setStep(5); await refreshHistory() }
  }
  function resetWizard() { setStep(0); setHeaderMode('AUTO'); setProgress({ processed: 0, total: 0 }); clearFile() }

  return <>
    <PageHeading title="Importações hidráulicas" description="Importação operacional de alimentações e DMCs, preservando arquivo, RAW imutável e qualidade separada." action={<Badge tone="info">CSV · SUPPLY_OUTLET · DMC</Badge>} />
    <ol className="wizard-steps import-operational-steps">{STEPS.map((label, index) => <li key={label} className={index === step ? 'active' : index < step ? 'done' : ''}><span>{index < step ? '✓' : index + 1}</span>{label}</li>)}</ol>
    {error && <div className="import-error" role="alert">{error}</div>}
    <Card className="import-wizard">
      {step === 0 && <Configuration sourceMode={sourceMode} chooseSource={chooseSource} supplyGroup={supplyGroup} setSupplyGroup={setSupplyGroup} channel={channel} chooseChannel={chooseChannel} unit={unit} setUnit={chooseSupplyUnit} selectedDmcId={selectedDmcId} setSelectedDmcId={(id) => { setSelectedDmcId(id); clearFile() }} activeDmcs={activeDmcs} dmcLoading={dmcsQuery.loading} file={file} source={source} mappings={mappings} isMockMode={isMockMode} selectFile={selectFile} canContinue={Boolean(file && table && source && (sourceMode === 'DMC' || unit))} continueMapping={() => setStep(1)} />}
      {step === 1 && table && source && <MappingStep table={table} source={source} file={file} mappings={mappings} preview={preview} encoding={encoding} delimiter={delimiter} headerMode={headerMode} readiness={readiness} channel={channel} changeMapping={changeMapping} changeUnit={changeUnit} parseAgain={parseAgain} setEncoding={setEncoding} setDelimiter={setDelimiter} goBack={() => setStep(0)} runPrevalidation={runPrevalidation} />}
      {step === 2 && validation && source && table && <ReviewStep title="3. Pré-validação" file={file} source={source} mappings={mappings} validation={validation} table={table} back={() => setStep(1)} next={() => setStep(3)} />}
      {step === 3 && validation && source && table && <ReviewStep title="4. Confirmação final" file={file} source={source} mappings={mappings} validation={validation} table={table} confirm={() => { const checkbox = document.querySelector<HTMLInputElement>('#raw-confirm'); if (checkbox?.checked) void confirmImport(); else setError('Marque a confirmação de revisão antes de importar.') }} />}
      {step === 4 && <div className="wizard-panel"><RefreshCw className="spin" /><h3>5. Processamento em lotes</h3><progress value={progress.processed} max={progress.total || 1} /><strong>{progress.processed.toLocaleString('pt-BR')} / {progress.total.toLocaleString('pt-BR')} medições processadas</strong><p className="desc">Storage privado sem sobrescrita; RAW confirmado permanece imutável.</p></div>}
      {step === 5 && <div className="wizard-panel">{result ? <><CheckCircle2 className="good" size={40} /><h3>6. Importação concluída</h3><ImportMetrics summary={result} dmcName={result.import.dmc_id ? dmcNames.get(result.import.dmc_id) : undefined} /></> : <><h3>Importação não concluída</h3><p className="desc">Nenhuma tentativa automática será realizada.</p></>}<button type="button" onClick={resetWizard}>Nova importação</button></div>}
    </Card>
    <History history={history} loading={historyLoading} dmcNames={dmcNames} select={(item) => void openHistoryDetail(item)} />
    {historyDetailLoading && <DataState loading error={null} empty="" />}
    {selectedHistory && <Card className="import-history-detail"><div className="section-title"><div><h3>Detalhes da importação</h3><p className="desc">Consulta somente leitura. RAW não pode ser editado nem excluído.</p></div><button type="button" className="secondary-button" onClick={() => setSelectedHistory(null)}>Fechar</button></div><ImportMetrics summary={selectedHistory} dmcName={selectedHistory.import.dmc_id ? dmcNames.get(selectedHistory.import.dmc_id) : undefined} /></Card>}
  </>
}

type ConfigurationProps = { sourceMode: SourceMode; chooseSource: (value: SourceMode) => void; supplyGroup: SupplyGroup; setSupplyGroup: (value: SupplyGroup) => void; channel: OperationalChannel; chooseChannel: (value: OperationalChannel) => void; unit: string; setUnit: (value: string) => void; selectedDmcId: string; setSelectedDmcId: (value: string) => void; activeDmcs: Array<{ id: string; name: string }>; dmcLoading: boolean; file: File | null; source: ImportSource | null; mappings: ColumnMapping[]; isMockMode: boolean; selectFile: (file?: File) => Promise<void>; canContinue: boolean; continueMapping: () => void }
function Configuration(props: ConfigurationProps) {
  return <div className="wizard-panel"><FileSpreadsheet size={36} /><h3>1. Configure a importação</h3><div className="operational-config"><fieldset><legend>Origem</legend><div className="button-row button-row-start"><button type="button" className={props.sourceMode === 'SUPPLY_OUTLET' ? 'active' : ''} onClick={() => props.chooseSource('SUPPLY_OUTLET')}>Alimentação</button><button type="button" className={props.sourceMode === 'DMC' ? 'active' : ''} onClick={() => props.chooseSource('DMC')}>DMC</button></div><small>{props.sourceMode === 'DMC' ? 'source_type = DMC · supply_group = NULL' : 'source_type = SUPPLY_OUTLET · dmc_id = NULL'}</small></fieldset>{props.sourceMode === 'DMC' ? <label>DMC ativo<select aria-label="DMC ativo" value={props.selectedDmcId} disabled={props.dmcLoading} onChange={(event) => props.setSelectedDmcId(event.target.value)}><option value="">Selecione o DMC</option>{props.activeDmcs.map((dmc) => <option key={dmc.id} value={dmc.id}>{dmc.name}</option>)}</select></label> : <><fieldset><legend>Alimentação</legend><div className="button-row button-row-start"><button type="button" className={props.supplyGroup === 'REDE' ? 'active' : ''} onClick={() => props.setSupplyGroup('REDE')}>REDE</button><button type="button" className={props.supplyGroup === 'XIXOVA' ? 'active' : ''} onClick={() => props.setSupplyGroup('XIXOVA')}>XIXOVA</button></div></fieldset><fieldset><legend>Canal</legend><div className="button-row button-row-start"><button type="button" className={props.channel === 'PRESSURE_SUPPLY' ? 'active' : ''} onClick={() => props.chooseChannel('PRESSURE_SUPPLY')}>Pressão</button><button type="button" className={props.channel === 'FLOW' ? 'active' : ''} onClick={() => props.chooseChannel('FLOW')}>Vazão</button></div></fieldset><label>Unidade original{props.channel === 'PRESSURE_SUPPLY' ? <select value="mca" disabled><option>mca</option></select> : <select value={props.unit} onChange={(event) => props.setUnit(event.target.value)}><option value="">Confirmar</option><option value="m3_h">m³/h</option><option value="l_s">L/s</option></select>}</label></>}<label>Arquivo CSV<input aria-label="Arquivo hidráulico CSV" type="file" accept=".csv,text/csv" disabled={props.isMockMode || (props.sourceMode === 'DMC' && !props.source)} onChange={(event) => void props.selectFile(event.target.files?.[0])} /></label></div>{props.file && props.source && <ContextSummary file={props.file} source={props.source} mappings={props.mappings} />}{props.isMockMode && <p className="note">Importação disponível somente com Supabase configurado e sessão ADMIN/GESTOR.</p>}<div className="button-row"><button type="button" disabled={!props.canContinue} onClick={props.continueMapping}>Continuar para mapeamento</button></div></div>
}

type MappingProps = { table: ParsedTable; source: ImportSource; file: File | null; mappings: ColumnMapping[]; preview: unknown[][]; encoding: FileEncoding; delimiter: Delimiter; headerMode: HeaderMode; readiness: { ready: boolean; reasons: string[] }; channel: OperationalChannel; changeMapping: (index: number, value: ImportChannel) => void; changeUnit: (index: number, value: string) => void; parseAgain: (encoding: FileEncoding, delimiter: Delimiter, headerMode?: HeaderMode) => void; setEncoding: (value: FileEncoding) => void; setDelimiter: (value: Delimiter) => void; goBack: () => void; runPrevalidation: () => Promise<void> }
function MappingStep(props: MappingProps) {
  const options = mappingChannelOptions(props.source.type, props.channel)
  return <div className="wizard-panel"><h3>2. Mapeamento e prévia</h3><ContextSummary file={props.file} source={props.source} mappings={props.mappings} /><div className="parser-controls"><label>Encoding<select value={props.encoding} onChange={(event) => { const value = event.target.value as FileEncoding; props.setEncoding(value); props.parseAgain(value, props.delimiter) }}><option>UTF-8</option><option>WINDOWS-1252</option></select></label><label>Delimitador<select value={props.delimiter} onChange={(event) => { const value = event.target.value as Delimiter; props.setDelimiter(value); props.parseAgain(props.encoding, value) }}><option value=";">Ponto e vírgula (;)</option><option value=",">Vírgula (,)</option><option value={'\t'}>Tabulação</option></select></label></div><div className="header-choice"><div><strong>Cabeçalho detectado:</strong> {props.table.suggestedHeaderMode === 'ABSENT' ? 'Provavelmente ausente' : props.table.suggestedHeaderMode === 'PRESENT' ? 'Provavelmente presente' : 'Detecção ambígua'} <Badge tone={props.table.headerConfidence === 'HIGH' ? 'success' : 'warning'}>{props.table.headerConfidence}</Badge></div><label>Cabeçalho do arquivo<select value={props.headerMode} onChange={(event) => props.parseAgain(props.encoding, props.delimiter, event.target.value as HeaderMode)}><option value="AUTO">Detectar automaticamente</option><option value="PRESENT">Primeira linha é cabeçalho</option><option value="ABSENT">Arquivo não possui cabeçalho</option></select></label></div><div className="table-wrap"><table><thead><tr><th>Coluna</th><th>Mapear como</th><th>Unidade</th><th>Sugestão</th></tr></thead><tbody>{props.mappings.map((mapping) => <tr key={mapping.index}><td>{mapping.index + 1} · <strong>{mapping.displayName}</strong><small className="cell-note">{mapping.headerOriginal ?? 'Sem cabeçalho original'}</small></td><td><select aria-label={`Mapeamento da coluna ${mapping.index + 1}`} value={mapping.channelType} onChange={(event) => props.changeMapping(mapping.index, event.target.value as ImportChannel)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></td><td>{mapping.channelType === 'FLOW' && props.source.type === 'DMC' ? <select aria-label={`Unidade da coluna ${mapping.index + 1}`} value={mapping.unit ?? ''} onChange={(event) => props.changeUnit(mapping.index, event.target.value)}><option value="">Confirmar</option><option value="m3_h">m³/h</option><option value="l_s">L/s</option></select> : mapping.unit ?? '—'}</td><td><Badge tone={mapping.confidence === 'HIGH' ? 'success' : mapping.confidence === 'MEDIUM' ? 'warning' : 'neutral'}>{mapping.confidence}</Badge></td></tr>)}</tbody></table></div><h4>Primeiras {props.preview.length} linhas interpretadas</h4><div className="table-wrap preview-table"><table><thead><tr><th>Linha</th>{props.table.headers.map((header, index) => <th key={`${index}-${header}`}>{header}</th>)}</tr></thead><tbody>{props.preview.map((row, rowIndex) => <tr key={rowIndex}><td>{rowIndex + (props.table.hasHeader ? 2 : 1)}</td>{row.map((value, columnIndex) => { const mapping = props.mappings[columnIndex]; return <td key={columnIndex}><span>{String(value ?? '')}</span>{mapping?.channelType === 'TIMESTAMP' && <small className="cell-note">{parseLocalTimestamp(value) ?? 'TIMESTAMP INVÁLIDO'}</small>}{mapping && isDataChannel(mapping.channelType) && <small className="cell-note">numérico: {String(parseLocaleNumber(value) ?? 'NULL/ERRO')}</small>}</td>})}</tr>)}</tbody></table></div>{!props.readiness.ready && <div className="note" role="status"><strong>Para habilitar a pré-validação:</strong><ul>{props.readiness.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}<div className="button-row"><button type="button" className="secondary-button" onClick={props.goBack}>Voltar</button><button type="button" disabled={!props.readiness.ready} onClick={() => void props.runPrevalidation()}>Pré-validar arquivo</button></div></div>
}

function ReviewStep({ title, file, source, mappings, validation, table, back, next, confirm }: { title: string; file: File | null; source: ImportSource; mappings: ColumnMapping[]; validation: PrevalidationResult; table: ParsedTable; back?: () => void; next?: () => void; confirm?: () => void }) {
  return <div className="wizard-panel"><h3>{title}</h3><ContextSummary file={file} source={source} mappings={mappings} /><PrevalidationMetrics value={validation} mappings={mappings} table={table} /><div className="note">Warnings e gaps são registrados por canal. Nenhum timestamp é criado, preenchido ou excluído.</div>{confirm ? <><label className="confirmation-box"><input type="checkbox" required id="raw-confirm" /> Confirmo arquivo, origem, DMC/alimentação, canais, unidades, timestamps, warnings e rejeições.</label><button type="button" className="danger-confirm" onClick={confirm}>Confirmar importação RAW</button></> : <div className="button-row"><button type="button" className="secondary-button" onClick={back}>Revisar mapeamento</button><button type="button" onClick={next}>Continuar para confirmação</button></div>}</div>
}

function ContextSummary({ file, source, mappings }: { file: File | null; source: ImportSource; mappings: ColumnMapping[] }) {
  const channels = mappings.filter((item) => isDataChannel(item.channelType))
  return <dl className="validation-grid context-grid"><div><dt>Arquivo</dt><dd>{file?.name ?? '—'}</dd></div><div><dt>Origem</dt><dd>{source.type}</dd></div><div><dt>DMC/Alimentação</dt><dd>{source.type === 'DMC' ? source.dmc.name : source.supplyGroup}</dd></div><div><dt>Canais</dt><dd>{channels.map((item) => item.channelType).join(', ') || 'A mapear'}</dd></div><div><dt>Unidades RAW</dt><dd>{channels.map((item) => `${item.channelType}: ${item.unit ?? '—'}`).join(' · ') || 'A confirmar'}</dd></div></dl>
}

function PrevalidationMetrics({ value, mappings, table }: { value: PrevalidationResult; mappings: ColumnMapping[]; table: ParsedTable }) {
  const quality = summarizeFlags(value.flags.map((flag) => ({ flag_type: flag.flagType, severity: flag.severity, details: flag.details })))
  const channels = summarizePrevalidationChannels(value, mappings)
  const items = [['Status', value.invalidTimestampCount === 0 && value.numericParseErrorCount === 0 ? 'Pronto para importar' : 'Com rejeições/warnings'], ['Período', `${formatDate(value.firstReading)} → ${formatDate(value.lastReading)}`], ['Linhas', value.sourceRowCount.toLocaleString('pt-BR')], ['RAW total previsto', value.measurements.length.toLocaleString('pt-BR')], ['Encoding', table.encoding], ['Delimitador', table.delimiter === '\t' ? 'Tabulação' : table.delimiter ?? '—'], ['Cabeçalho', table.hasHeader ? 'Presente' : 'Ausente'], ['Cadência', value.predominantCadenceMinutes ? `${value.predominantCadenceMinutes} min` : '—'], ['Flags', quality.total.toLocaleString('pt-BR')], ['Rejeições', value.rejectedRows.length.toLocaleString('pt-BR')]]
  return <><dl className="validation-grid">{items.map(([label, content]) => <div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}</dl><div className="table-wrap"><table><thead><tr><th>Canal/coluna</th><th>Unidade</th><th>RAW previsto</th><th>Mínimo</th><th>Máximo</th><th>Flags</th><th>Gaps</th><th>Cobertura</th></tr></thead><tbody>{channels.map((item) => <tr key={item.mapping.index}><td>{item.mapping.channelType}<small className="cell-note">Coluna {item.mapping.index + 1}: {item.mapping.displayName}</small></td><td>{item.mapping.unit}</td><td>{item.rawCount.toLocaleString('pt-BR')}</td><td>{formatRawNumber(item.minimum)}</td><td>{formatRawNumber(item.maximum)}</td><td>{item.quality.total}</td><td>{item.quality.gaps} · {item.quality.missingTimestamps} ausências</td><td>{item.coverage === null ? '—' : `${formatNumber(item.coverage)}%`}</td></tr>)}</tbody></table></div>{quality.breakdown.length > 0 && <div className="quality-breakdown"><strong>Warnings previstos</strong>{quality.breakdown.map((flag) => <Badge key={`${flag.type}-${flag.severity}`} tone="warning">{flag.type}: {flag.count}</Badge>)}</div>}</>
}

function History({ history, loading, dmcNames, select }: { history: ImportOperationalSummary[]; loading: boolean; dmcNames: Map<string, string>; select: (item: DataImportRow) => void }) {
  return <Card><h3>Histórico de importações</h3>{loading ? <DataState loading error={null} empty="" /> : history.length === 0 ? <div className="table-empty">Nenhuma importação registrada</div> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Arquivo</th><th>Origem</th><th>DMC/Alimentação</th><th>Canais</th><th>Período</th><th>RAW</th><th>Cobertura</th><th>Status</th><th>Detalhes</th></tr></thead><tbody>{history.map((summary) => <tr key={summary.import.id}><td>{formatDate(summary.import.imported_at)}</td><td>{summary.import.original_filename}</td><td>{summary.import.source_type}</td><td>{summary.import.dmc_id ? dmcNames.get(summary.import.dmc_id) ?? 'DMC não localizado' : summary.import.supply_group}</td><td>{summary.channels.map((item) => item.channelType).join(', ')}</td><td>{formatDate(summary.firstReading)} → {formatDate(summary.lastReading)}</td><td>{summary.rawCount.toLocaleString('pt-BR')}</td><td>{summary.coveragePercent === null ? '—' : `${formatNumber(summary.coveragePercent)}%`}</td><td><Badge tone={summary.import.status === 'COMPLETED' ? 'success' : summary.import.status === 'FAILED' ? 'danger' : 'warning'}>{summary.import.status}</Badge></td><td><button type="button" className="secondary-button inline-button" onClick={() => select(summary.import)}><Search size={15} /> Consultar</button></td></tr>)}</tbody></table></div>}</Card>
}

function ImportMetrics({ summary, dmcName }: { summary: ImportOperationalSummary; dmcName?: string }) {
  const items = [['Status', summary.import.status], ['Arquivo', summary.import.original_filename], ['Origem', summary.import.source_type], ['DMC/Alimentação', dmcName ?? summary.import.supply_group ?? '—'], ['Período', `${formatDate(summary.firstReading)} → ${formatDate(summary.lastReading)}`], ['Linhas', summary.import.row_count.toLocaleString('pt-BR')], ['RAW criado', summary.rawCount.toLocaleString('pt-BR')], ['Flags', summary.flags.toLocaleString('pt-BR')], ['Gaps', `${summary.gaps} · ${summary.missingTimestamps} ausências`], ['Cobertura', summary.coveragePercent === null ? '—' : `${formatNumber(summary.coveragePercent)}%`], ['Rejeições', summary.rejections.toLocaleString('pt-BR')], ['Import ID', summary.import.id]]
  return <><dl className="result-grid">{items.map(([label, content]) => <div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}</dl><div className="table-wrap"><table><thead><tr><th>Canal</th><th>Unidade</th><th>RAW</th><th>Mínimo</th><th>Máximo</th><th>Flags</th><th>Gaps</th><th>Cobertura</th></tr></thead><tbody>{summary.channels.map((item) => <tr key={item.channelType}><td>{CHANNEL_LABELS[item.channelType] ?? item.channelType}<small className="cell-note">{item.channelType}</small></td><td>{item.rawUnit}{item.normalizedUnit && item.normalizedUnit !== item.rawUnit ? ` → ${item.normalizedUnit}` : ''}</td><td>{item.rawCount.toLocaleString('pt-BR')}</td><td>{formatRawNumber(item.minimum)}</td><td>{formatRawNumber(item.maximum)}</td><td>{item.flags}</td><td>{item.gaps} · {item.missingTimestamps} ausências</td><td>{item.coveragePercent === null ? '—' : `${formatNumber(item.coveragePercent)}%`}</td></tr>)}</tbody></table></div>{summary.flagBreakdown.length > 0 && <div className="quality-breakdown"><strong>Flags registradas</strong>{summary.flagBreakdown.map((flag) => <Badge key={`${flag.type}-${flag.severity}`} tone="warning">{flag.type}: {flag.count}</Badge>)}</div>}</>
}

export default ImportacoesPage
