import { AlertTriangle, ArrowRight, BarChart3, DatabaseZap, Gauge, TrendingDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PerformanceChart, type ContractChartPoint } from '../components/performance/PerformanceChart'
import { Card } from '../components/ui/Card'
import { DataState } from '../components/ui/DataState'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'
import { useAuth } from '../features/auth/useAuth'
import { useContractDashboard, useDmcs, useHydraulicOverview } from '../hooks/useReferenceData'

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const label = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')

export function ExecutivoPage() {
  const { isMockMode } = useAuth()
  const contract = useContractDashboard()
  const hydraulics = useHydraulicOverview()
  const dmcs = useDmcs()
  const loading = contract.loading || hydraulics.loading || dmcs.loading
  const error = contract.error ?? hydraulics.error ?? dmcs.error
  if (!isMockMode && (loading || error)) return <DataState loading={loading} error={error} empty="Painel executivo indisponível" />
  const { months, projections, baseline, targetReduction100, referenceReduction120 } = contract.data
  const current = months.at(-1)
  const november = projections.at(-1)
  const targetVp = baseline-targetReduction100
  const referenceVp = baseline-referenceReduction120
  const dmcNames = new Map(dmcs.data.map((dmc) => [dmc.id,dmc.name]))
  const ranked = [...hydraulics.data].sort((a,b) => {
    const score = (item: typeof a) => item.critical_hours_below_3_2*5+item.hours_below_10+(item.trend==='WORSENING'?500:0)+(100-item.coverage_pct)*10+Number(item.quality_flags.PRESSURE_OUTLIER ?? 0)
    return score(b)-score(a)
  })
  const critical = hydraulics.data.filter((item) => (item.red_days_pct ?? 0)>0 || item.critical_hours_below_3_2>0).length
  const attention = hydraulics.data.filter((item) => item.trend==='WORSENING' || item.coverage_pct<95).length
  const quality = hydraulics.data.length ? hydraulics.data.reduce((sum,item)=>sum+item.coverage_pct,0)/hydraulics.data.length : 0
  const series: ContractChartPoint[] = [...months,...projections].map((row)=>({ competence:label(row.competence),vd:row.vd,vcm:row.vcm,vp:row.vp,status:row.status }))
  const alerts = [
    ...(months.filter((item)=>item.status==='REALIZED'&&item.attainment_pct<100).map((item)=>`Performance de ${label(item.competence)} abaixo de 100% (${number.format(item.attainment_pct)}%).`)),
    ...(current?.status==='PARTIAL'?[`Competência ${label(current.competence)} é parcial e não consolidada.`]:[]),
    ...(ranked.some((item)=>item.trend==='WORSENING')?['Há DMC com tendência mensal de piora; investigação prioritária recomendada.']:[]),
    ...(ranked.some((item)=>item.critical_hours_below_3_2>0)?['Ocorrências críticas abaixo de 3,2 mca foram registradas na janela crítica.']:[]),
    ...(ranked.some((item)=>item.coverage_pct<95)?['Há DMC com qualidade de dados comprometida por baixa cobertura.']:[]),
  ]

  return <><PageHeading title="Visão executiva" description="Performance global de Praia Grande e prioridades hidráulicas para investigação, sem inferência causal." />{isMockMode&&<MockNotice>Conecte o Supabase para consultar o painel gerencial oficial.</MockNotice>}{!isMockMode&&<>
    <div className="kpi-grid executive-kpis"><Card><span className="kpi-label">Atingimento atual</span><strong className="kpi-value">{number.format(current?.attainment_pct ?? 0)}%</strong><small>ago/26 parcial</small></Card><Card><span className="kpi-label">VP atual</span><strong className="kpi-value">{number.format(current?.vp ?? 0)} m³</strong></Card><Card><span className="kpi-label">Redução atual</span><strong className="kpi-value">{number.format(current?.reduction ?? 0)} m³</strong></Card><Card><span className="kpi-label">Projeção nov/26</span><strong className="kpi-value">{number.format(november?.vp ?? 0)} m³</strong><small>{number.format(november?.attainment_pct ?? 0)}% volumétrico</small></Card><Card><span className="kpi-label">DMCs críticos / atenção</span><strong className="kpi-value">{critical} / {attention}</strong></Card><Card><span className="kpi-label">Qualidade geral</span><strong className="kpi-value">{number.format(quality)}%</strong><small>cobertura média mensal</small></Card></div>
    <div className="grid-main"><Card className="wide-card"><h3><BarChart3 size={18}/> Performance contratual</h3><PerformanceChart data={series} baseline={baseline} target100={targetVp} reference120={referenceVp} compactView /></Card><Card><h3><Gauge size={18}/> Leitura gerencial</h3><div className="insight-list"><div><TrendingDown className="good"/><span><strong>Acima da meta atual</strong><small>Agosto parcial registra {number.format(current?.attainment_pct ?? 0)}%.</small></span></div><div><ArrowRight className="info-text"/><span><strong>Trajetória até novembro</strong><small>Projeção de {number.format(november?.attainment_pct ?? 0)}%, se confirmada.</small></span></div><div><AlertTriangle className="warn"/><span><strong>Separação obrigatória</strong><small>Realizado, parcial e projetado não são consolidados entre si.</small></span></div><div><DatabaseZap className="info-text"/><span><strong>Financeiro reservado</strong><small>Percentual exibido é volumétrico.</small></span></div></div></Card></div>
    <Card><h3>Diagnóstico hidráulico — DMCs prioritários para investigação</h3><p className="desc">Ranking gerencial por pressão, tendência e qualidade. Não atribui responsabilidade pelo resultado contratual.</p><div className="executive-dmc-list">{ranked.slice(0,5).map((item,index)=><Link to={`/pressoes/${item.dmc_id}`} key={item.id}><span className="executive-rank">{index+1}</span><span><strong>{dmcNames.get(item.dmc_id)??'DMC'}</strong><small>{item.trend==='WORSENING'?'Tendência de piora':item.coverage_pct<95?'Qualidade de dados comprometida':'Pressão abaixo da referência'}</small></span><span><strong>{number.format(item.hours_below_10)} h &lt; 10 mca</strong><small>{number.format(item.critical_hours_below_3_2)} h críticas · cobertura {number.format(item.coverage_pct)}%</small></span><ArrowRight size={18}/></Link>)}</div></Card>
    <Card><h3>Alertas executivos</h3><div className="executive-alerts">{alerts.map((alert)=><div key={alert}><AlertTriangle size={17}/><span>{alert}</span></div>)}</div></Card>
  </>}</>
}

export default ExecutivoPage
