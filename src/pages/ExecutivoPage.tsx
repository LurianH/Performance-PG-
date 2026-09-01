import { AlertTriangle, ArrowDownRight, CheckCircle2, Waves } from 'lucide-react'
import { PerformanceChart } from '../components/performance/PerformanceChart'
import { Card } from '../components/ui/Card'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'
import { useAuth } from '../features/auth/useAuth'
import { useContractParameters, useOfficialEmptyStates } from '../hooks/useReferenceData'
import { DataState } from '../components/ui/DataState'
import { findContractNumericValue } from '../features/performance/reference-data'

const volume = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

export function ExecutivoPage() {
  const { isMockMode } = useAuth()
  const parameters = useContractParameters()
  const { months } = useOfficialEmptyStates()
  const display = (key: string) => {
    const value = findContractNumericValue(parameters.data, key)
    return value == null ? 'Não configurado' : `${volume.format(value)} m³`
  }
  return (
    <>
      <PageHeading title="Visão executiva" description="Acompanhamento visual do contrato e dos sinais operacionais, mantendo apuração e diagnóstico em planos separados." />
      {isMockMode && <MockNotice />}
      <div className="kpi-grid">
        <Card><span className="kpi-label">Baseline de VP</span><strong className="kpi-value">{isMockMode ? '—' : display('VP_BASELINE')}</strong><small>{isMockMode ? 'aguardando parâmetro contratual vigente' : 'vigência analítica desde dez/2025'}</small></Card>
        <Card><span className="kpi-label">Meta de redução 100%</span><strong className="kpi-value">{isMockMode ? '—' : display('REDUCTION_TARGET_100')}</strong><small>objetivo volumétrico</small></Card>
        <Card><span className="kpi-label">Referência 120%</span><strong className="kpi-value">{isMockMode ? '—' : display('REDUCTION_TARGET_120')}</strong><small>referência volumétrica</small></Card>
        <Card><span className="kpi-label">Alimentações</span><strong className="kpi-value">2</strong><small>REDE e Xixová</small></Card>
        <Card><span className="kpi-label">DMCs mapeados</span><strong className="kpi-value">14</strong><small>diagnóstico, não apuração</small></Card>
      </div>
      <div className="grid-main">
        <Card><h3>VP mensal — realizado × projetado</h3>{isMockMode ? <><p className="desc">Série estática do protótipo, somente para demonstração visual.</p><PerformanceChart /></> : <DataState loading={parameters.loading || months.loading} error={parameters.error ?? months.error} empty="Dados mensais ainda não importados" />}</Card>
        <Card><h3>Leitura executiva</h3><div className="insight-list">
          <div><CheckCircle2 className="good" /><span><strong>Separação preservada</strong><small>Performance oficial permanece no total Praia Grande.</small></span></div>
          <div><Waves className="info-text" /><span><strong>Diagnóstico por alimentação</strong><small>REDE e Xixová agrupam os 14 DMCs.</small></span></div>
          <div><AlertTriangle className="warn" /><span><strong>Qualidade antes do indicador</strong><small>Falha de instrumentação não vira melhora hidráulica.</small></span></div>
          <div><ArrowDownRight className="bad" /><span><strong>Índices indisponíveis</strong><small>CPE, IAL e IPS não são calculados nesta etapa.</small></span></div>
        </div></Card>
      </div>
    </>
  )
}

export default ExecutivoPage
