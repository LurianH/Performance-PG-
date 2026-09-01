import { AlertOctagon, CircleSlash2, Copy, FileQuestion, SplitSquareVertical, TimerOff, UploadCloud } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'
import { useAuth } from '../features/auth/useAuth'
import { useDmcCoverage, useImports, useReferenceCounts } from '../hooks/useReferenceData'
import { DataState } from '../components/ui/DataState'

const checks = [
  [TimerOff, 'Gaps de telemetria', 'Aguardando importação', 'Timestamps ausentes não serão interpolados automaticamente.'],
  [Copy, 'Duplicidades', 'Aguardando importação', 'Registros repetidos serão identificados sem sobrescrever o bruto.'],
  [CircleSlash2, 'Zeros suspeitos', 'Aguardando contexto', 'Zero de equipamento indisponível não será leitura hidráulica.'],
  [AlertOctagon, 'Outliers', 'Aguardando critérios', 'Nenhum dado será expurgado sem motivo e auditoria.'],
  [FileQuestion, 'Cobertura válida', 'Não disponível', 'Ausência de dado permanece ausente, nunca zero.'],
] as const

export function QualidadePage() {
  const { isMockMode } = useAuth()
  const counts = useReferenceCounts()
  const coverage = useDmcCoverage()
  const imports = useImports()
  return (
    <>
      <PageHeading title="Qualidade dos dados" description="Arquitetura preparada para importações, RAW imutável, validação derivada e expurgos reversíveis." action={<button className="secondary-button inline-button" disabled><UploadCloud size={16} /> Nova importação</button>} />
      {isMockMode && <MockNotice>nenhum arquivo foi importado e nenhum contador foi inventado nesta etapa.</MockNotice>}
      {!isMockMode && (counts.loading || counts.error) ? <DataState loading={counts.loading} error={counts.error} empty="" /> : !isMockMode && <div className="kpi-grid"><Card><span className="kpi-label">Importações</span><strong className="kpi-value">{counts.data.imports}</strong></Card><Card><span className="kpi-label">Registros RAW</span><strong className="kpi-value">{counts.data.raw}</strong></Card><Card><span className="kpi-label">Flags</span><strong className="kpi-value">{counts.data.flags}</strong></Card><Card><span className="kpi-label">Gaps</span><strong className="kpi-value">{counts.data.gaps}</strong></Card><Card><span className="kpi-label">Duplicidades</span><strong className="kpi-value">{counts.data.duplicates}</strong></Card><Card><span className="kpi-label">Rejeições</span><strong className="kpi-value">{counts.data.rejectedRows}</strong></Card><Card><span className="kpi-label">Expurgos</span><strong className="kpi-value">{counts.data.exclusions}</strong></Card></div>}
      <div className="quality-grid">{checks.map(([Icon, title, status, text]) => <Card key={title}><Icon className="info-text" /><h3>{title}</h3><strong className="quality-status">{status}</strong><p className="desc">{text}</p></Card>)}</div>
      <div className="grid-main">
        <Card><h3>Importações</h3><div className="table-wrap"><table><thead><tr><th>Arquivo</th><th>Origem</th><th>Status</th><th>Linhas</th></tr></thead><tbody>{imports.data.length ? imports.data.map((item) => <tr key={item.id}><td>{item.original_filename}</td><td>{item.source_type === 'SUPPLY_OUTLET' ? `Saída ${item.supply_group}` : 'DMC'}</td><td><Badge tone={item.status === 'COMPLETED' ? 'success' : 'warning'}>{item.status}</Badge></td><td>{item.row_count.toLocaleString('pt-BR')}</td></tr>) : <tr><td colSpan={4}><div className="table-empty">Nenhuma importação registrada</div></td></tr>}</tbody></table></div><p className="desc section-footnote">Hash e contexto identificam repetição sem duplicar RAW.</p></Card>
        <Card><h3><SplitSquareVertical size={16} /> RAW × VALIDADO</h3><div className="comparison-box"><div><Badge tone="neutral">RAW</Badge><strong>Imutável</strong><small>Valor, unidade e payload originais preservados.</small></div><div><Badge tone="success">VALIDADO</Badge><strong>Derivado</strong><small>RAW + flags + equipamento + expurgos ativos.</small></div></div></Card>
      </div>
      <Card><h3>Fluxo de qualidade</h3><div className="flow"><span>Arquivo original + hash</span><i>→</i><span>RAW imutável</span><i>→</i><span>Flags de qualidade</span><i>→</i><span>Expurgo reversível</span><i>→</i><span>View VALIDADA</span></div></Card>
      {!isMockMode && <Card><h3>Cobertura RAW por DMC</h3>{coverage.loading || coverage.error ? <DataState loading={coverage.loading} error={coverage.error} empty="" /> : <div className="compact-list">{coverage.data.map((dmc) => <div key={dmc.id}><span>{dmc.name}</span><strong>{dmc.rawCount.toLocaleString('pt-BR')} medições</strong></div>)}</div>}</Card>}
    </>
  )
}

export default QualidadePage
