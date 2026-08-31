import { AlertOctagon, CircleSlash2, Copy, FileQuestion, TimerOff } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'

const checks = [
  [TimerOff, 'Gaps de telemetria', 'Aguardando importação', 'Timestamps ausentes não serão interpolados automaticamente.'],
  [Copy, 'Duplicidades', 'Aguardando importação', 'Registros repetidos serão identificados sem sobrescrever o bruto.'],
  [CircleSlash2, 'Zeros suspeitos', 'Aguardando validação', 'Zero de equipamento indisponível não será leitura hidráulica.'],
  [AlertOctagon, 'Outliers', 'Aguardando critérios', 'Nenhum dado será expurgado sem motivo e auditoria.'],
  [FileQuestion, 'Cobertura válida', 'Não disponível', 'Ausência de dado permanece ausente, nunca zero.'],
] as const

export function QualidadePage() {
  return (
    <><PageHeading title="Qualidade dos dados" description="Fundação para RAW, VALIDADO, expurgos e rastreabilidade das séries." /><MockNotice>contadores e percentuais não foram inventados; os estados abaixo indicam ausência de importação.</MockNotice><div className="quality-grid">{checks.map(([Icon, title, status, text]) => <Card key={title}><Icon className="info-text" /><h3>{title}</h3><strong className="quality-status">{status}</strong><p className="desc">{text}</p></Card>)}</div><Card><h3>Fluxo futuro de dados</h3><div className="flow"><span>Arquivo original</span><i>→</i><span>RAW preservado</span><i>→</i><span>Validação</span><i>→</i><span>Expurgo auditável</span><i>→</i><span>Série validada</span></div></Card></>
  )
}
