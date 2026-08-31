import { Cable, Gauge, LockKeyhole, Scale, Wrench } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'
import { equipmentPeriodsMock, technicalParametersMock } from '../data/mock/configuration.mock'
import { dmcsMock } from '../data/mock/dmcs.mock'

export function ConfiguracoesPage() {
  return (
    <>
      <PageHeading title="Configurações técnicas" description="Interface administrativa preparada para parâmetros versionados, topologia e vigências de equipamentos." />
      <MockNotice>controles locais somente para visualização; nenhuma alteração é salva ou enviada ao Supabase.</MockNotice>
      <div className="settings-section-title"><Gauge /><div><h3>Parâmetros hidráulicos e janelas</h3><p>Valores demonstrativos provenientes da especificação técnica.</p></div></div>
      <div className="parameter-grid">
        {technicalParametersMock.map((parameter) => <Card key={parameter.key}><span className="parameter-key">{parameter.key}</span><label>{parameter.label}<div className="mock-input"><strong>{parameter.value}</strong><span>{parameter.unit}</span></div></label></Card>)}
      </div>
      <div className="settings-section-title"><Scale /><div><h3>Pesos do IPS</h3><p>Preparação estrutural; o motor e os pesos oficiais não foram implementados.</p></div></div>
      <Card><div className="flow"><span>Severidade absoluta · 0–35</span><i>+</i><span>CPE · 0–20</span><i>+</i><span>IAL · 0–20</span><i>+</i><span>Persistência · 0–15</span><i>+</i><span>Déficit diurno · 0–10</span></div></Card>
      <div className="settings-grid">
        <Card><div className="settings-title"><h3><Cable /> Topologia DMC → alimentação</h3><LockKeyhole size={18} /></div><div className="compact-list">{dmcsMock.map((dmc) => <div key={dmc.name}><span>{dmc.name}</span><strong>{dmc.supply === 'XIXOVA' ? 'Xixová' : 'REDE'}</strong></div>)}</div></Card>
        <Card><div className="settings-title"><h3><Wrench /> Vigências de equipamentos</h3><LockKeyhole size={18} /></div><div className="compact-list">{equipmentPeriodsMock.map((period) => <div key={`${period.dmc}-${period.equipment}`}><span><strong>{period.dmc}</strong><small>{period.equipment} · {period.period}</small></span><em>{period.status}</em></div>)}</div></Card>
      </div>
      <div className="note">Alterações futuras exigirão perfil ADMIN, vigência, justificativa e registro automático em auditoria.</div>
    </>
  )
}

export default ConfiguracoesPage
