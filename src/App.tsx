import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'

const ExecutivoPage = lazy(() => import('./pages/ExecutivoPage'))
const ApuracaoPage = lazy(() => import('./pages/ApuracaoPage'))
const ProjecoesPage = lazy(() => import('./pages/ProjecoesPage'))
const PressoesPage = lazy(() => import('./pages/PressoesPage'))
const QualidadePage = lazy(() => import('./pages/QualidadePage'))
const ConfiguracoesPage = lazy(() => import('./pages/ConfiguracoesPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))

export function App() {
  return (
    <Suspense fallback={<div className="route-loading" role="status">Carregando página…</div>}>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<ExecutivoPage />} />
          <Route path="apuracao" element={<ApuracaoPage />} />
          <Route path="projecoes" element={<ProjecoesPage />} />
          <Route path="pressoes" element={<PressoesPage />} />
          <Route path="qualidade" element={<QualidadePage />} />
          <Route path="configuracoes" element={<ProtectedRoute allowedRoles={['ADMIN']}><ConfiguracoesPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
