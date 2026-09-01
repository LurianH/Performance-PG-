import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ContractMonthStatus } from '../../types/database.types'

export interface ContractChartPoint { competence: string; vp: number; vd: number; vcm: number; status: ContractMonthStatus }
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const full = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

export function PerformanceChart({ data, baseline, target100, reference120, compactView = false }: { data: ContractChartPoint[]; baseline: number; target100: number; reference120: number; compactView?: boolean }) {
  const chartData = data.map((item) => ({ ...item, realized: item.status === 'REALIZED' ? item.vp : null, partial: item.status === 'PARTIAL' ? item.vp : null, projected: item.status === 'PROJECTED' ? item.vp : null }))
  return <div className={compactView ? 'chart-container executive-chart' : 'chart-container'} aria-label="VP mensal e referências contratuais"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 12, right: 18, left: 8, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#e4ebe8" /><XAxis dataKey="competence" /><YAxis tickFormatter={(value: number) => compact.format(value)} width={68} /><Tooltip formatter={(value, name) => [`${full.format(Number(value))} m³`, String(name)]} /><Legend /><ReferenceLine y={baseline} stroke="#6b7a74" strokeDasharray="6 4" label="Baseline" /><ReferenceLine y={target100} stroke="#1f6d4b" strokeDasharray="4 4" label="Meta 100%" /><ReferenceLine y={reference120} stroke="#3d6d86" strokeDasharray="3 3" label="Ref. 120%" /><Line connectNulls type="monotone" dataKey="realized" name="Realizado" stroke="#1f6d4b" strokeWidth={3} /><Line connectNulls type="monotone" dataKey="partial" name="Parcial" stroke="#bb8420" strokeWidth={3} /><Line connectNulls type="monotone" dataKey="projected" name="Projetado" stroke="#3d6d86" strokeWidth={3} strokeDasharray="6 4" /></LineChart></ResponsiveContainer></div>
}

export function VolumesChart({ data }: { data: ContractChartPoint[] }) {
  return <div className="chart-container"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="competence" /><YAxis tickFormatter={(value: number) => compact.format(value)} width={68} /><Tooltip formatter={(value, name) => [`${full.format(Number(value))} m³`, String(name)]} /><Legend /><Bar dataKey="vd" name="VD — disponibilizado" fill="#3d6d86" /><Bar dataKey="vcm" name="VCM — consumo medido" fill="#5ca878" /></BarChart></ResponsiveContainer></div>
}
