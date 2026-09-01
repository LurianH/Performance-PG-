import { Radio } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DmcMock } from '../../types/domain'
import type { DmcHydraulicMonthlyRow, DmcRow, DmcSeriesSummary } from '../../types/database.types'
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

const channelLabels: Record<string, string> = { PRESSURE_PC: 'Pressão PC', PRESSURE_UPSTREAM: 'Pressão montante', PRESSURE_DOWNSTREAM: 'Pressão jusante', FLOW: 'Vazão' }

const trendLabel = { IMPROVEMENT: 'Melhora', STABLE: 'Estabilidade', WORSENING: 'Piora', NO_BASELINE: 'Sem comparativo' } as const

export function OfficialDmcCard({ dmc, series = [], diagnostic }: { dmc: DmcRow; series?: DmcSeriesSummary[]; diagnostic?: DmcHydraulicMonthlyRow }) {
  const available = series.length > 0
  return (
    <article className="dmc-card">
      <div className="dmc-card-head"><div><h3>{dmc.name}</h3><span className="channel"><Radio size={13} /> PC {dmc.pc_channel ?? 'Não configurado'}</span></div><Badge tone={available ? 'success' : 'neutral'}>{available ? 'Dados disponíveis' : 'Aguardando importação'}</Badge></div>
      <div className="badge-row"><Badge tone="info">Alimentação {dmc.supply_group === 'XIXOVA' ? 'Xixová' : 'REDE'}</Badge><Badge tone={dmc.has_vrp ? 'success' : 'neutral'}>{dmc.has_vrp ? 'Com VRP' : 'Sem VRP'}</Badge></div>
      {available ? <div className="compact-list dmc-series-list">{series.map((item) => <div key={`${item.importId}-${item.channelType}`}><span><strong>{channelLabels[item.channelType] ?? item.channelType}</strong><small className="cell-note">{new Date(item.firstReading).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} → {new Date(item.lastReading).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</small></span><strong>{item.rawCount.toLocaleString('pt-BR')} RAW · {item.unit}{item.normalizedUnit && item.normalizedUnit !== item.unit ? ` → ${item.normalizedUnit === 'l_s' ? 'L/s' : item.normalizedUnit}` : ''} · {item.gapCount} gaps · {item.coveragePercent?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) ?? '—'}%</strong></div>)}</div> : <p>{dmc.notes ?? 'Nenhuma série hidráulica oficial importada.'}</p>}
      {diagnostic && <><div className="diagnostic-card-grid"><span>PC mín.<strong>{diagnostic.pc_min?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) ?? '—'} mca</strong></span><span>PC média<strong>{diagnostic.pc_avg?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) ?? '—'} mca</strong></span><span>PC máx.<strong>{diagnostic.pc_max?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) ?? '—'} mca</strong></span><span>Abaixo 10<strong>{diagnostic.hours_below_10.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h</strong></span><span>Crítico 3,2<strong>{diagnostic.critical_hours_below_3_2.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h</strong></span><span>Cobertura<strong>{diagnostic.coverage_pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong></span><span>Vazão média<strong>{diagnostic.flow_avg_l_s?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) ?? '—'} L/s</strong></span><span>Tendência<strong>{trendLabel[diagnostic.trend]}</strong></span></div><Link className="primary-button button-link" to={`/pressoes/${dmc.id}`}>Abrir diagnóstico</Link></>}
      <span className="mock-card-label">DIAGNÓSTICO HIDRÁULICO — SEM IPS/CPE/IAL</span>
    </article>
  )
}
