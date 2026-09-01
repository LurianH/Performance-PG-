import { Badge } from '../ui/Badge'

const labels: Record<string, string> = { REALIZED: 'Realizado', PARTIAL: 'Parcial', PROJECTED: 'Projetado', REALIZADO_ATUAL: 'Realizado (demo)', PARCIAL: 'Parcial (demo)', PROJETADO: 'Projetado (demo)' }

export function StatusBadge({ status }: { status: string }) {
  const tone = status === 'REALIZED' || status === 'REALIZADO_ATUAL' ? 'success' : status === 'PARTIAL' || status === 'PARCIAL' ? 'warning' : 'info'
  return <Badge tone={tone}>{labels[status] ?? status}</Badge>
}
