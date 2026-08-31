import { performanceMonthsMock } from '../data/mock/performance.mock'
import { StatusBadge } from '../components/performance/StatusBadge'
import { Card } from '../components/ui/Card'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'

const number = new Intl.NumberFormat('pt-BR')

export function ApuracaoPage() {
  return (
    <>
      <PageHeading title="Apuração mensal" description="Estrutura visual da apuração contratual do total Praia Grande." />
      <MockNotice>valores transcritos do protótipo; a aplicação não executa VP, redução ou atingimento.</MockNotice>
      <div className="grid-main">
        <Card className="wide-card"><div className="table-wrap"><table><thead><tr><th>Competência</th><th>VP</th><th>Redução</th><th>% meta</th><th>Origem/status</th></tr></thead><tbody>{performanceMonthsMock.map((month) => <tr key={month.competence}><td><strong>{month.competence}</strong></td><td>{number.format(month.vp)}</td><td>{number.format(month.reduction)}</td><td>{month.attainment.toLocaleString('pt-BR')}%</td><td><StatusBadge status={month.status} /></td></tr>)}</tbody></table></div></Card>
        <Card><h3>Regras documentadas</h3><div className="rule"><span>Volume perdido</span><strong>VP = VD − VCM</strong></div><div className="rule"><span>Redução</span><strong>Baseline − VP</strong></div><div className="rule"><span>Performance</span><strong>Redução ÷ meta</strong></div><div className="note">Fórmulas exibidas como documentação. Nenhuma delas está implementada nesta etapa.</div></Card>
      </div>
    </>
  )
}

export default ApuracaoPage
