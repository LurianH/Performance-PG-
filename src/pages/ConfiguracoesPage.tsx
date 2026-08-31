import { LockKeyhole } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'

const sections = [
  ['Critérios do PC', 'Thresholds documentados; sem aplicação a PM, PJ ou saídas.'],
  ['Janelas de análise', 'Noturna, crítica e referência diurna serão versionadas.'],
  ['Banda neutra do IAL', 'Parâmetro futuro, não regulatório e não implementado.'],
  ['Pesos do IPS', 'Pesos futuros configuráveis; nenhuma pontuação é calculada.'],
  ['DMC → alimentação', 'Associação administrativa REDE/Xixová.'],
  ['Marcos de equipamentos', 'Instalações, falhas e períodos de indisponibilidade.'],
]

export function ConfiguracoesPage() {
  return (
    <><PageHeading title="Configurações técnicas" description="Estrutura visual dos parâmetros que futuramente exigirão perfil autorizado e auditoria." /><MockNotice>controles bloqueados nesta etapa; nenhuma configuração é persistida.</MockNotice><div className="settings-grid">{sections.map(([title, description]) => <Card key={title}><div className="settings-title"><h3>{title}</h3><LockKeyhole size={18} /></div><p className="desc">{description}</p><button className="secondary-button" disabled>Configuração futura</button></Card>)}</div><div className="note">Supabase está apenas preparado por variáveis de ambiente. Não existe conexão, projeto real, autenticação, tabela ou migration.</div></>
  )
}
