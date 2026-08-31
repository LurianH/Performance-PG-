import type { PerformanceMonthMock } from '../../types/domain'
import { Badge } from '../ui/Badge'

const labels = { REALIZADO_ATUAL: 'Realizado (demo)', PARCIAL: 'Parcial (demo)', PROJETADO: 'Projetado (demo)' } as const

export function StatusBadge({ status }: Pick<PerformanceMonthMock, 'status'>) {
  const tone = status === 'REALIZADO_ATUAL' ? 'success' : 'warning'
  return <Badge tone={tone}>{labels[status]}</Badge>
}
