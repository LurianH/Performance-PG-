import { Card } from '../components/ui/Card'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'
import { useAuth } from '../features/auth/useAuth'
import { useOfficialEmptyStates } from '../hooks/useReferenceData'
import { DataState } from '../components/ui/DataState'

const projectionRows = [
  ['set/26', '3.462.153', '2.033.973', '1.428.180', '176,3%'],
  ['out/26', '3.610.736', '2.053.673', '1.557.062', '134,4%'],
  ['nov/26', '3.560.379', '2.168.735', '1.391.644', '188,2%'],
]

export function ProjecoesPage() {
  const { isMockMode } = useAuth()
  const { scenarios } = useOfficialEmptyStates()
  return (
    <><PageHeading title="Projeções" description="Cenários visuais separados dos dados realizados e parciais." />{isMockMode && <MockNotice>cenário sazonal-base estático; não há motor de projeção ou premissas calculadas.</MockNotice>}<div className="grid-main"><Card className="wide-card">{isMockMode ? <><h3>Cenário sazonal-base</h3><div className="table-wrap"><table><thead><tr><th>Mês</th><th>VD</th><th>VCM</th><th>VP</th><th>% meta</th></tr></thead><tbody>{projectionRows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={cell}>{index === 0 ? <strong>{cell}</strong> : cell}</td>)}</tr>)}</tbody></table></div></> : <DataState loading={scenarios.loading} error={scenarios.error} empty="Nenhum cenário de projeção oficial cadastrado." />}</Card><Card><h3>Cenário conservador/manual</h3><div className="empty-state"><strong>Não disponível</strong><p>Nenhum valor foi inventado para preencher a ausência desse cenário.</p></div></Card></div></>
  )
}

export default ProjecoesPage
