import { PerformanceChart, VolumesChart, type ContractChartPoint } from '../components/performance/PerformanceChart'
import { StatusBadge } from '../components/performance/StatusBadge'
import { Card } from '../components/ui/Card'
import { DataState } from '../components/ui/DataState'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'
import { useAuth } from '../features/auth/useAuth'
import { useContractDashboard } from '../hooks/useReferenceData'

const volume = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })
const pct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const competence = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')

export function ApuracaoPage() {
  const { isMockMode } = useAuth()
  const dashboard = useContractDashboard()
  if (!isMockMode && (dashboard.loading || dashboard.error)) return <DataState loading={dashboard.loading} error={dashboard.error} empty="Apuração indisponível" />
  const { months, projections, baseline, targetReduction100, referenceReduction120 } = dashboard.data
  const current = months.at(-1)
  const allRows = [...months, ...projections]
  const chartData: ContractChartPoint[] = allRows.map((row) => ({ competence: competence(row.competence), vd: row.vd, vcm: row.vcm, vp: row.vp, status: row.status }))
  const targetVp = baseline - targetReduction100
  const referenceVp = baseline - referenceReduction120

  return <>
    <PageHeading title="Apuração contratual" description="Performance volumétrica oficial do sistema global de Praia Grande. Percentual de atingimento não representa remuneração financeira." />
    {isMockMode && <MockNotice>Conecte o Supabase para consultar a apuração oficial.</MockNotice>}
    {!isMockMode && <>
      <div className="kpi-grid contract-kpis"><Card><span className="kpi-label">Baseline de VP</span><strong className="kpi-value">{volume.format(baseline)} m³</strong><small>jun/2023–mai/2024</small></Card><Card><span className="kpi-label">VP atual/parcial</span><strong className="kpi-value">{volume.format(current?.vp ?? 0)} m³</strong><small>{competence(current?.competence ?? '')} · parcial</small></Card><Card><span className="kpi-label">Redução atual</span><strong className="kpi-value">{volume.format(current?.reduction ?? 0)} m³</strong><small>baseline − VP</small></Card><Card><span className="kpi-label">Atingimento atual</span><strong className="kpi-value">{pct.format(current?.attainment_pct ?? 0)}%</strong><small>volumétrico, não financeiro</small></Card><Card><span className="kpi-label">Meta 100%</span><strong className="kpi-value">{volume.format(targetVp)} m³</strong><small>VP alvo</small></Card><Card><span className="kpi-label">Referência 120%</span><strong className="kpi-value">{volume.format(referenceVp)} m³</strong><small>VP equivalente</small></Card></div>
      <Card><h3>VP mensal × referências contratuais</h3><PerformanceChart data={chartData} baseline={baseline} target100={targetVp} reference120={referenceVp} /></Card>
      <Card><h3>VD × VCM</h3><p className="desc">VD = volume disponibilizado · VCM = volume de consumo medido.</p><VolumesChart data={chartData} /></Card>
      <Card><h3>Apuração mensal</h3><div className="table-wrap"><table><thead><tr><th>Competência</th><th>VD</th><th>VCM</th><th>VP</th><th>Redução</th><th>Atingimento</th><th>Status</th></tr></thead><tbody>{allRows.map((row) => <tr key={`${row.status}-${row.competence}`} className={`contract-row contract-${row.status.toLowerCase()}`}><td><strong>{competence(row.competence)}</strong></td><td>{volume.format(row.vd)} m³</td><td>{volume.format(row.vcm)} m³</td><td>{volume.format(row.vp)} m³</td><td>{volume.format(row.reduction)} m³</td><td>{pct.format(row.attainment_pct)}%</td><td><StatusBadge status={row.status} /></td></tr>)}</tbody></table></div><p className="note">Agosto/2026 permanece PARCIAL. Set–nov/2026 são PROJETADOS e não integram os realizados consolidados.</p></Card>
      <Card><h3>Bloco financeiro</h3><div className="empty-state"><strong>Reservado</strong><p>Fórmula contratual financeira ainda não parametrizada.</p></div></Card>
    </>}
  </>
}

export default ApuracaoPage
