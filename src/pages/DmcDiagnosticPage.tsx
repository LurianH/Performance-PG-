import { ArrowLeft, Moon, ShieldAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { DataState } from '../components/ui/DataState'
import { PageHeading } from '../components/ui/PageHeading'
import { useDmcs, useHydraulicDmcDetail } from '../hooks/useReferenceData'

const format = (value: number | null, digits = 2) => value === null ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits: digits })
const statusTone = { GREEN: 'success', YELLOW: 'warning', RED: 'danger', DATA_FAILURE: 'warning', NO_DATA: 'neutral' } as const
const trendLabel = { IMPROVEMENT: 'Melhora', STABLE: 'Estabilidade', WORSENING: 'Piora', NO_BASELINE: 'Sem comparativo' } as const

export function DmcDiagnosticPage() {
  const { dmcId } = useParams()
  const dmcs = useDmcs()
  const diagnostic = useHydraulicDmcDetail(dmcId)
  const dmc = dmcs.data.find((item) => item.id === dmcId)
  const latest = diagnostic.data.monthly.at(-1)
  const chart = diagnostic.data.daily.map((row) => ({ date: row.analysis_date.slice(5), pcMin: row.pc_min, pcAvg: row.pc_avg, pcMax: row.pc_max, flow: row.flow_avg_l_s }))

  if (dmcs.loading || diagnostic.loading || dmcs.error || diagnostic.error) return <DataState loading={dmcs.loading || diagnostic.loading} error={dmcs.error ?? diagnostic.error} empty="Diagnóstico não localizado" />
  if (!dmc || !latest) return <DataState loading={false} error={null} empty="Ainda não há diagnóstico calculado para este DMC." />

  return <>
    <Link className="diagnostic-back" to="/pressoes"><ArrowLeft size={16} /> Voltar aos DMCs</Link>
    <PageHeading title={dmc.name} description={`Diagnóstico hidráulico ${latest.rule_version} · competência ${new Date(`${latest.competence}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`} action={<Badge tone={latest.red_days_pct && latest.red_days_pct > 0 ? 'danger' : latest.yellow_days_pct && latest.yellow_days_pct > 0 ? 'warning' : 'success'}>{trendLabel[latest.trend]}</Badge>} />
    <div className="kpi-grid"><Card><span className="kpi-label">PC mínima</span><strong className="kpi-value">{format(latest.pc_min)} mca</strong></Card><Card><span className="kpi-label">PC média</span><strong className="kpi-value">{format(latest.pc_avg)} mca</strong></Card><Card><span className="kpi-label">PC máxima</span><strong className="kpi-value">{format(latest.pc_max)} mca</strong></Card><Card><span className="kpi-label">Abaixo de 10</span><strong className="kpi-value">{format(latest.hours_below_10, 1)} h</strong></Card><Card><span className="kpi-label">Crítico abaixo de 3,2</span><strong className="kpi-value">{format(latest.critical_hours_below_3_2, 1)} h</strong></Card></div>
    <div className="grid-main"><Card className="wide-card"><h3>Pressão no PC</h3><p className="desc">Faixas analíticas de 3,2 / 10 / 50 mca. Montante e jusante não recebem essa classificação.</p><div className="chart-container"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" minTickGap={28} /><YAxis unit=" mca" /><Tooltip /><Legend /><ReferenceLine y={3.2} stroke="#b03a32" strokeDasharray="4 4" /><ReferenceLine y={10} stroke="#d19b2a" strokeDasharray="4 4" /><ReferenceLine y={50} stroke="#b03a32" strokeDasharray="4 4" /><Line type="monotone" dataKey="pcMin" name="Mínima" stroke="#b03a32" dot={false} /><Line type="monotone" dataKey="pcAvg" name="Média" stroke="#247052" dot={false} /><Line type="monotone" dataKey="pcMax" name="Máxima" stroke="#356f8d" dot={false} /></ComposedChart></ResponsiveContainer></div></Card><Card><h3><Moon size={18} /> Comportamento noturno</h3><div className="compact-list"><div><span>PC média noturna</span><strong>{format(diagnostic.data.daily.at(-1)?.pc_night_avg ?? null)} mca</strong></div><div><span>Vazão noturna média</span><strong>{format(latest.flow_night_avg_l_s)} L/s</strong></div><div><span>Correlação PC × vazão</span><strong>{format(latest.night_pc_flow_correlation, 3)}</strong></div><div><span>Cobertura mensal</span><strong>{format(latest.coverage_pct, 1)}%</strong></div></div><p className="note">Correlação exploratória, sem classificação de causalidade.</p></Card></div>
    <Card><h3>Vazão diária</h3><div className="chart-container"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" minTickGap={28} /><YAxis unit=" L/s" /><Tooltip /><Line type="monotone" dataKey="flow" name="Vazão média" stroke="#247052" dot={false} /></ComposedChart></ResponsiveContainer></div></Card>
    <Card><h3><ShieldAlert size={18} /> Qualidade analítica mensal</h3><div className="quality-breakdown">{Object.entries(latest.quality_flags).map(([key, value]) => <Badge key={key} tone={value > 0 ? 'warning' : 'neutral'}>{key}: {value}</Badge>)}</div><p className="desc">Outliers: mediana ± 6×MAD por DMC/canal. Valores RAW são preservados e continuam no agregado; nenhuma correção ou exclusão automática.</p></Card>
    <Card><h3>Tabela diária</h3><div className="table-wrap diagnostic-table"><table><thead><tr><th>Data</th><th>Status</th><th>PC mín./méd./máx.</th><th>&lt; 10</th><th>&lt; 3,2 crítico</th><th>Vazão</th><th>Cobertura</th><th>Gaps</th><th>Maior gap</th></tr></thead><tbody>{diagnostic.data.daily.map((row) => <tr key={row.id}><td>{new Date(`${row.analysis_date}T12:00:00`).toLocaleDateString('pt-BR')}</td><td><Badge tone={statusTone[row.daily_status]}>{row.daily_status}</Badge></td><td>{format(row.pc_min)} / {format(row.pc_avg)} / {format(row.pc_max)}</td><td>{format(row.hours_below_10, 1)} h</td><td>{format(row.critical_hours_below_3_2, 1)} h</td><td>{format(row.flow_avg_l_s)} L/s</td><td>{format(row.coverage_pct, 1)}%</td><td>{row.gap_count}</td><td>{format(row.largest_gap_minutes, 0)} min</td></tr>)}</tbody></table></div></Card>
    <Card><h3>Resumo mensal</h3><div className="table-wrap"><table><thead><tr><th>Competência</th><th>PC média</th><th>PC mín./máx.</th><th>&lt; 10</th><th>&lt; 3,2</th><th>GREEN/YELLOW/RED</th><th>Vazão noturna</th><th>Cobertura</th><th>Falhas</th><th>Tendência</th></tr></thead><tbody>{diagnostic.data.monthly.map((row) => <tr key={row.id}><td>{row.competence.slice(0, 7)}</td><td>{format(row.pc_avg)}</td><td>{format(row.pc_min)} / {format(row.pc_max)}</td><td>{format(row.hours_below_10, 1)} h</td><td>{format(row.critical_hours_below_3_2, 1)} h</td><td>{format(row.green_days_pct, 1)}% / {format(row.yellow_days_pct, 1)}% / {format(row.red_days_pct, 1)}%</td><td>{format(row.flow_night_avg_l_s)} L/s</td><td>{format(row.coverage_pct, 1)}%</td><td>{row.data_failure_days}</td><td>{trendLabel[row.trend]}</td></tr>)}</tbody></table></div></Card>
  </>
}

export default DmcDiagnosticPage
