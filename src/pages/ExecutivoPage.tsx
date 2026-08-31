import { AlertTriangle, ArrowDownRight, CheckCircle2, Waves } from 'lucide-react'
import { PerformanceChart } from '../components/performance/PerformanceChart'
import { Card } from '../components/ui/Card'
import { MockNotice } from '../components/ui/MockNotice'
import { PageHeading } from '../components/ui/PageHeading'

export function ExecutivoPage() {
  return (
    <>
      <PageHeading title="Visão executiva" description="Acompanhamento visual do contrato e dos sinais operacionais, mantendo apuração e diagnóstico em planos separados." />
      <MockNotice />
      <div className="kpi-grid">
        <Card><span className="kpi-label">Baseline de VP</span><strong className="kpi-value">1.969.934</strong><small>m³/mês · referência estática</small></Card>
        <Card><span className="kpi-label">Meta de redução 100%</span><strong className="kpi-value good">307.309,626</strong><small>m³/mês · referência estática</small></Card>
        <Card><span className="kpi-label">Ago/26 parcial</span><strong className="kpi-value warn">148,43%</strong><small>transcrição visual, não calculada</small></Card>
        <Card><span className="kpi-label">Alimentações</span><strong className="kpi-value">2</strong><small>REDE e Xixová</small></Card>
        <Card><span className="kpi-label">DMCs mapeados</span><strong className="kpi-value">14</strong><small>diagnóstico, não apuração</small></Card>
      </div>
      <div className="grid-main">
        <Card><h3>VP mensal — realizado × projetado</h3><p className="desc">Ago/26 é parcial. Set–nov/26 preservam as projeções estáticas do protótipo.</p><PerformanceChart /></Card>
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
