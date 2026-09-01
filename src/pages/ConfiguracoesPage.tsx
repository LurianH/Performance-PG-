import { Cable, Gauge, LockKeyhole, Scale, Wrench } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'
import { equipmentPeriodsMock, technicalParametersMock } from '../data/mock/configuration.mock'
import { dmcsMock } from '../data/mock/dmcs.mock'
import { useAuth } from '../features/auth/useAuth'
import { useDmcs, useReferenceCounts, useTechnicalParameters } from '../hooks/useReferenceData'
import { DataState } from '../components/ui/DataState'

const parameterLabels: Record<string, string> = {
  PC_NORMAL_MIN: 'PC normal mínimo', PC_CRITICAL_MIN: 'PC crítico mínimo', PC_MAX: 'PC máximo',
  NIGHT_START: 'Início da janela noturna', NIGHT_END: 'Fim da janela noturna',
  CRITICAL_WINDOW_START: 'Início da janela crítica', CRITICAL_WINDOW_END: 'Fim da janela crítica',
}

export function ConfiguracoesPage() {
  const { isMockMode } = useAuth()
  const technical = useTechnicalParameters()
  const dmcs = useDmcs()
  const counts = useReferenceCounts()
  const missing = ['IAL_NEUTRAL_BAND', 'IPS_WEIGHTS']
  return (
    <>
      <PageHeading title="Configurações técnicas" description="Interface administrativa preparada para parâmetros versionados, topologia e vigências de equipamentos." />
      {isMockMode && <MockNotice>controles locais somente para visualização; nenhuma alteração é salva ou enviada ao Supabase.</MockNotice>}
      <div className="settings-section-title"><Gauge /><div><h3>Parâmetros hidráulicos e janelas</h3><p>Valores demonstrativos provenientes da especificação técnica.</p></div></div>
      {!isMockMode && (technical.loading || technical.error) ? <DataState loading={technical.loading} error={technical.error} empty="" /> : <div className="parameter-grid">
        {(isMockMode ? technicalParametersMock : technical.data.map((parameter) => ({ key: parameter.key, label: parameterLabels[parameter.key] ?? parameter.key, value: parameter.numeric_value == null ? (parameter.text_value ?? 'Não configurado') : String(parameter.numeric_value), unit: parameter.key.startsWith('PC_') ? 'mca' : undefined }))).map((parameter) => <Card key={parameter.key}><span className="parameter-key">{parameter.key}</span><label>{parameter.label}<div className="mock-input"><strong>{parameter.value}</strong><span>{parameter.unit}</span></div></label></Card>)}
        {!isMockMode && missing.map((key) => <Card key={key}><span className="parameter-key">{key}</span><label>{key}<div className="mock-input"><strong>Não configurado</strong></div></label></Card>)}
      </div>}
      <div className="settings-section-title"><Scale /><div><h3>Pesos do IPS</h3><p>Preparação estrutural; o motor e os pesos oficiais não foram implementados.</p></div></div>
      <Card><div className="flow"><span>Severidade absoluta · 0–35</span><i>+</i><span>CPE · 0–20</span><i>+</i><span>IAL · 0–20</span><i>+</i><span>Persistência · 0–15</span><i>+</i><span>Déficit diurno · 0–10</span></div></Card>
      <div className="settings-grid">
        <Card><div className="settings-title"><h3><Cable /> Topologia DMC → alimentação</h3><LockKeyhole size={18} /></div>{!isMockMode && (dmcs.loading || dmcs.error) ? <DataState loading={dmcs.loading} error={dmcs.error} empty="" /> : <div className="compact-list">{isMockMode ? dmcsMock.map((dmc) => <div key={dmc.name}><span>{dmc.name}</span><strong>{dmc.supply === 'XIXOVA' ? 'Xixová' : 'REDE'}</strong></div>) : dmcs.data.map((dmc) => <div key={dmc.id}><span>{dmc.name}</span><strong>{dmc.supply_group === 'XIXOVA' ? 'Xixová' : 'REDE'}</strong></div>)}</div>}</Card>
        <Card><div className="settings-title"><h3><Wrench /> Vigências de equipamentos</h3><LockKeyhole size={18} /></div>{isMockMode ? <div className="compact-list">{equipmentPeriodsMock.map((period) => <div key={`${period.dmc}-${period.equipment}`}><span><strong>{period.dmc}</strong><small>{period.equipment} · {period.period}</small></span><em>{period.status}</em></div>)}</div> : <DataState loading={counts.loading} error={counts.error} empty="Nenhuma vigência cadastrada. Há pendências documentais a confirmar." />}</Card>
      </div>
      <div className="note">Alterações futuras exigirão perfil ADMIN, vigência, justificativa e registro automático em auditoria.</div>
    </>
  )
}

export default ConfiguracoesPage
