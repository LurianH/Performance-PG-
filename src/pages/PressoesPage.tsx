import { useMemo, useState } from 'react'
import { DmcCard } from '../components/hydraulics/DmcCard'
import { Badge } from '../components/ui/Badge'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'
import { dmcsMock } from '../data/mock/dmcs.mock'

export function PressoesPage() {
  const [supply, setSupply] = useState<'TODAS' | 'REDE' | 'XIXOVA'>('TODAS')
  const dmcs = useMemo(() => supply === 'TODAS' ? dmcsMock : dmcsMock.filter((dmc) => dmc.supply === supply), [supply])
  return (
    <><PageHeading title="Diagnóstico de pressões" description="Estrutura dos 14 DMCs por alimentação, com saúde hidráulica e confiabilidade em eixos independentes." action={<Badge tone="info">{dmcs.length} DMCs exibidos</Badge>} /><MockNotice>classificações qualitativas do protótipo; sem cálculo hidráulico, ranking IPS ou diagnóstico oficial.</MockNotice><div className="supply-summary"><button className={supply === 'TODAS' ? 'active' : ''} onClick={() => setSupply('TODAS')}>Todos <small>14 DMCs</small></button><button className={supply === 'REDE' ? 'active' : ''} onClick={() => setSupply('REDE')}>REDE <small>8 DMCs</small></button><button className={supply === 'XIXOVA' ? 'active' : ''} onClick={() => setSupply('XIXOVA')}>Xixová <small>6 DMCs</small></button></div><div className="dmc-grid">{dmcs.map((dmc) => <DmcCard key={dmc.name} dmc={dmc} />)}</div></>
  )
}

export default PressoesPage
