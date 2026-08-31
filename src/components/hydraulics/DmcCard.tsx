import { Radio } from 'lucide-react'
import type { DmcMock } from '../../types/domain'
import { Badge } from '../ui/Badge'

export function DmcCard({ dmc }: { dmc: DmcMock }) {
  const healthTone = dmc.hydraulicHealth === 'Crítica' ? 'danger' : dmc.hydraulicHealth === 'Atenção' ? 'warning' : 'neutral'
  const qualityTone = dmc.dataReliability === 'Boa' ? 'success' : dmc.dataReliability === 'Parcial' ? 'warning' : 'neutral'

  return (
    <article className="dmc-card">
      <div className="dmc-card-head">
        <div><h3>{dmc.name}</h3><span className="channel"><Radio size={13} /> PC {dmc.channel}</span></div>
        <Badge tone={healthTone}>{dmc.hydraulicHealth}</Badge>
      </div>
      <div className="badge-row"><Badge tone="info">Alimentação {dmc.supply === 'XIXOVA' ? 'Xixová' : 'REDE'}</Badge><Badge tone={qualityTone}>Dados {dmc.dataReliability.toLowerCase()}</Badge></div>
      <p>{dmc.note}</p>
      <span className="mock-card-label">TRIAGEM VISUAL — SEM IPS/CPE/IAL</span>
    </article>
  )
}
