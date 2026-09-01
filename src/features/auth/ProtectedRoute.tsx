import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { AppRole } from '../../types/database.types'
import { hasAllowedRole } from './domain-rules'
import { useAuth } from './useAuth'

export function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: AppRole[] }) {
  const { loading, session, role, isMockMode } = useAuth()
  const location = useLocation()

  if (isMockMode) return children
  if (loading) return <div className="route-loading" role="status">Carregando sessão…</div>
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (!role) return <Navigate to="/login" state={{ accessDenied: true }} replace />
  if (!hasAllowedRole(role, allowedRoles)) return <Navigate to="/" replace />
  return children
}
