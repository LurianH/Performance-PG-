import { ArrowRight, Target } from 'lucide-react'
import { PerformanceChart, type ContractChartPoint } from '../components/performance/PerformanceChart'
import { StatusBadge } from '../components/performance/StatusBadge'
import { Card } from '../components/ui/Card'
import { DataState } from '../components/ui/DataState'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'
import { useAuth } from '../features/auth/useAuth'
import { useContractDashboard } from '../hooks/useReferenceData'

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })
const pct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const label = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')

export function ProjecoesPage() {
  const { isMockMode } = useAuth()
  const query = useContractDashboard()
  if (!isMockMode && (query.loading || query.error)) return <DataState loading={query.loading} error={query.error} empty="Projeções indisponíveis" />
  const { months, projections, baseline, targetReduction100, referenceReduction120, scenario } = query.data
  const november = projections.at(-1)
  const targetVp = baseline - targetReduction100
  const referenceVp = baseline - referenceReduction120
  const weakest = projections.reduce((result, row) => !result || row.attainment_pct < result.attainment_pct ? row : result, projections[0])
  const series: ContractChartPoint[] = [...months, ...projections].map((row) => ({ competence: label(row.competence), vd: row.vd, vcm: row.vcm, vp: row.vp, status: row.status }))

  return <><PageHeading title="Projeções contratuais" description="Trajetória técnica oficial até novembro de 2026, separada dos meses realizados e do mês parcial." />{isMockMode && <MockNotice>Conecte o Supabase para consultar a projeção oficial.</MockNotice>}{!isMockMode && <>
    <div className="kpi-grid"><Card><span className="kpi-label">VP projetado nov/26</span><strong className="kpi-value">{number.format(november?.vp ?? 0)} m³</strong></Card><Card><span className="kpi-label">Atingimento nov/26</span><strong className="kpi-value">{pct.format(november?.attainment_pct ?? 0)}%</strong></Card><Card><span className="kpi-label">Menor projeção restante</span><strong className="kpi-value">{pct.format(weakest?.attainment_pct ?? 0)}%</strong><small>{label(weakest?.competence ?? projections[0]?.competence ?? '')}</small></Card><Card><span className="kpi-label">Margem sobre meta 100%</span><strong className="kpi-value">{number.format(targetVp-(november?.vp ?? targetVp))} m³</strong></Card><Card><span className="kpi-label">Margem sobre ref. 120%</span><strong className="kpi-value">{number.format(referenceVp-(november?.vp ?? referenceVp))} m³</strong></Card></div>
    <Card><h3>Realizado, parcial e projetado</h3><PerformanceChart data={series} baseline={baseline} target100={targetVp} reference120={referenceVp} /></Card>
    <div className="grid-main"><Card className="wide-card"><h3>{scenario?.name}</h3><div className="table-wrap"><table><thead><tr><th>Competência</th><th>VD projetado</th><th>VCM projetado</th><th>VP projetado</th><th>Redução</th><th>Atingimento</th><th>Status</th></tr></thead><tbody>{projections.map((row) => <tr key={row.id} className="contract-row contract-projected"><td><strong>{label(row.competence)}</strong></td><td>{number.format(row.vd)} m³</td><td>{number.format(row.vcm)} m³</td><td>{number.format(row.vp)} m³</td><td>{number.format(row.reduction)} m³</td><td>{pct.format(row.attainment_pct)}%</td><td><StatusBadge status={row.status} /></td></tr>)}</tbody></table></div></Card><Card className="projection-outlook"><Target /><h3>Se a trajetória projetada se confirmar</h3><p>Novembro encerra com VP de <strong>{number.format(november?.vp ?? 0)} m³</strong> e atingimento volumétrico de <strong>{pct.format(november?.attainment_pct ?? 0)}%</strong>.</p><div className="rule"><span>Meta 100%</span><strong>{(november?.vp ?? Infinity) <= targetVp ? 'Superada' : 'Não atingida'}</strong></div><div className="rule"><span>Referência 120%</span><strong>{(november?.vp ?? Infinity) <= referenceVp ? 'Superada' : 'Não atingida'}</strong></div><p className="note"><ArrowRight size={14} /> Leitura volumétrica gerencial. Remuneração financeira não parametrizada.</p></Card></div>
  </>}</>
}

export default ProjecoesPage
