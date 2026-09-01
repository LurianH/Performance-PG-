import { useMemo, useState } from 'react'
import { DmcCard, OfficialDmcCard } from '../components/hydraulics/DmcCard'
import { Badge } from '../components/ui/Badge'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'
import { dmcsMock } from '../data/mock/dmcs.mock'
import { useAuth } from '../features/auth/useAuth'
import { useDmcs } from '../hooks/useReferenceData'
import { DataState } from '../components/ui/DataState'
import { Card } from '../components/ui/Card'
import { useSupplySeries } from '../hooks/useReferenceData'

export function PressoesPage() {
  const [supply, setSupply] = useState<'TODAS' | 'REDE' | 'XIXOVA'>('TODAS')
  const { isMockMode } = useAuth()
  const official = useDmcs()
  const supplySeries = useSupplySeries()
  const dmcs = useMemo(() => isMockMode ? (supply === 'TODAS' ? dmcsMock : dmcsMock.filter((dmc) => dmc.supply === supply)) : [], [isMockMode, supply])
  const officialDmcs = useMemo(() => supply === 'TODAS' ? official.data : official.data.filter((dmc) => dmc.supply_group === supply), [official.data, supply])
  const count = isMockMode ? dmcs.length : officialDmcs.length
  const supplyAvailability = (['REDE', 'XIXOVA'] as const).map((group) => ({
    group,
    pressure: supplySeries.data.some((series) => series.supplyGroup === group && series.channelType === 'PRESSURE_SUPPLY'),
    flow: supplySeries.data.some((series) => series.supplyGroup === group && series.channelType === 'FLOW'),
  }))
  return (
    <><PageHeading title="Diagnóstico de pressões" description="Estrutura dos 14 DMCs por alimentação, com saúde hidráulica e confiabilidade em eixos independentes." action={<Badge tone="info">{count} DMCs exibidos</Badge>} />{isMockMode && <MockNotice>classificações qualitativas do protótipo; sem cálculo hidráulico, ranking IPS ou diagnóstico oficial.</MockNotice>}{!isMockMode && <Card><h3>Séries das saídas de alimentação</h3>{!supplySeries.loading && !supplySeries.error && <div className="compact-list">{supplyAvailability.map((item) => <div key={item.group}><span><strong>{item.group}</strong><small className="cell-note">Disponibilidade de séries da saída de alimentação</small></span><strong>Pressão {item.pressure ? 'disponível' : 'aguardando importação'} · Vazão {item.flow ? 'disponível' : 'aguardando importação'}</strong></div>)}</div>}{supplySeries.loading || supplySeries.error ? <DataState loading={supplySeries.loading} error={supplySeries.error} empty="" /> : supplySeries.data.length === 0 ? <div className="table-empty">Aguardando importação das séries REDE/XIXOVA</div> : <div className="compact-list">{supplySeries.data.map((series) => <div key={series.importId}><span><strong>{series.supplyGroup}</strong> · {series.channelType}<small className="cell-note">{new Date(series.firstReading).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} → {new Date(series.lastReading).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</small></span><strong>{series.rawCount.toLocaleString('pt-BR')} RAW · unidade RAW {series.unit}{series.normalizedUnit && series.channelType === 'FLOW' ? ` · normalizada ${series.normalizedUnit === 'l_s' ? 'L/s' : series.normalizedUnit}` : ''} · {series.gapCount} gaps · cobertura {series.coveragePercent?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) ?? '—'}%</strong></div>)}</div>}<p className="desc section-footnote">Pressão Xixová disponível — aguardando vazão para cruzamento P/Q. Dados sem classificação de PC, CPE, IAL ou IPS.</p></Card>}<div className="supply-summary"><button className={supply === 'TODAS' ? 'active' : ''} onClick={() => setSupply('TODAS')}>Todos <small>14 DMCs</small></button><button className={supply === 'REDE' ? 'active' : ''} onClick={() => setSupply('REDE')}>REDE <small>8 DMCs</small></button><button className={supply === 'XIXOVA' ? 'active' : ''} onClick={() => setSupply('XIXOVA')}>Xixová <small>6 DMCs</small></button></div>{!isMockMode && (official.loading || official.error) ? <DataState loading={official.loading} error={official.error} empty="Nenhum DMC cadastrado" /> : <div className="dmc-grid">{isMockMode ? dmcs.map((dmc) => <DmcCard key={dmc.name} dmc={dmc} />) : officialDmcs.map((dmc) => <OfficialDmcCard key={dmc.id} dmc={dmc} />)}</div>}</>
  )
}

export default PressoesPage
