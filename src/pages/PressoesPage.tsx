import { useMemo, useState } from 'react'
import { DmcCard, OfficialDmcCard } from '../components/hydraulics/DmcCard'
import { Badge } from '../components/ui/Badge'
import { DataState } from '../components/ui/DataState'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'
import { dmcsMock } from '../data/mock/dmcs.mock'
import { useAuth } from '../features/auth/useAuth'
import { useDmcs, useHydraulicOverview } from '../hooks/useReferenceData'

export function PressoesPage() {
  const [supply, setSupply] = useState<'TODAS' | 'REDE' | 'XIXOVA'>('TODAS')
  const { isMockMode } = useAuth()
  const official = useDmcs()
  const diagnostics = useHydraulicOverview()
  const dmcs = useMemo(() => isMockMode ? (supply === 'TODAS' ? dmcsMock : dmcsMock.filter((dmc) => dmc.supply === supply)) : [], [isMockMode, supply])
  const officialDmcs = useMemo(() => supply === 'TODAS' ? official.data : official.data.filter((dmc) => dmc.supply_group === supply), [official.data, supply])
  const count = isMockMode ? dmcs.length : officialDmcs.length
  const officialState = { loading: official.loading || diagnostics.loading, error: official.error ?? diagnostics.error }

  return <>
    <PageHeading title="Diagnóstico de pressões" description="Indicadores hidráulicos rastreáveis por DMC, separados da qualidade dos dados e sem inferência causal." action={<Badge tone="info">{count} DMCs exibidos</Badge>} />
    {isMockMode && <MockNotice>classificações qualitativas do protótipo; sem cálculo hidráulico, ranking IPS ou diagnóstico oficial.</MockNotice>}
    <div className="supply-summary"><button className={supply === 'TODAS' ? 'active' : ''} onClick={() => setSupply('TODAS')}>Todos <small>14 DMCs</small></button><button className={supply === 'REDE' ? 'active' : ''} onClick={() => setSupply('REDE')}>REDE <small>8 DMCs</small></button><button className={supply === 'XIXOVA' ? 'active' : ''} onClick={() => setSupply('XIXOVA')}>Xixová <small>6 DMCs</small></button></div>
    {!isMockMode && (officialState.loading || officialState.error) ? <DataState loading={officialState.loading} error={officialState.error} empty="Nenhum DMC cadastrado" /> : <div className="dmc-grid">{isMockMode ? dmcs.map((dmc) => <DmcCard key={dmc.name} dmc={dmc} />) : officialDmcs.map((dmc) => <OfficialDmcCard key={dmc.id} dmc={dmc} diagnostic={diagnostics.data.find((item) => item.dmc_id === dmc.id)} />)}</div>}
  </>
}

export default PressoesPage
