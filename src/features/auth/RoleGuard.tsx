import type { ReactNode } from 'react'
import type { AppRole } from '../../types/database.types'
import { hasAllowedRole } from './domain-rules'
import { useAuth } from './useAuth'

export function RoleGuard({ roles, children, fallback = null }: { roles: AppRole[]; children: ReactNode; fallback?: ReactNode }) {
  const { role, isMockMode } = useAuth()
  if (isMockMode) return children
  return hasAllowedRole(role, roles) ? children : fallback
}
