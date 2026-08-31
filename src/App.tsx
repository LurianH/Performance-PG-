import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { ApuracaoPage } from './pages/ApuracaoPage'
import { ConfiguracoesPage } from './pages/ConfiguracoesPage'
import { ExecutivoPage } from './pages/ExecutivoPage'
import { PressoesPage } from './pages/PressoesPage'
import { ProjecoesPage } from './pages/ProjecoesPage'
import { QualidadePage } from './pages/QualidadePage'

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<ExecutivoPage />} />
        <Route path="apuracao" element={<ApuracaoPage />} />
        <Route path="projecoes" element={<ProjecoesPage />} />
        <Route path="pressoes" element={<PressoesPage />} />
        <Route path="qualidade" element={<QualidadePage />} />
        <Route path="configuracoes" element={<ConfiguracoesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
