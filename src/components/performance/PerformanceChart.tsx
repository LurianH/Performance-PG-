import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { performanceMonthsMock, performanceReferenceMock } from '../../data/mock/performance.mock'

const compactNumber = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const fullNumber = new Intl.NumberFormat('pt-BR')

export function PerformanceChart() {
  return (
    <div className="chart-container" aria-label="Gráfico demonstrativo de VP mensal">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={performanceMonthsMock} margin={{ top: 16, right: 18, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4ebe8" />
          <XAxis dataKey="competence" tick={{ fill: '#6b7a74', fontSize: 11 }} />
          <YAxis tickFormatter={(value: number) => compactNumber.format(value)} tick={{ fill: '#6b7a74', fontSize: 11 }} width={62} />
          <Tooltip formatter={(value) => [`${fullNumber.format(Number(value))} m³`, 'VP demonstrativo']} />
          <Legend />
          <ReferenceLine y={performanceReferenceMock.baselineVp} stroke="#6f7b76" strokeDasharray="5 4" label="Baseline" />
          <ReferenceLine y={performanceReferenceMock.targetVp100} stroke="#5ca878" label="Meta 100%" />
          <Line type="monotone" dataKey="vp" name="VP — MOCK" stroke="#1f6d4b" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
