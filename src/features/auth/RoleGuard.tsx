import type { ReactNode } from 'react'
import type { AppRole } from '../../types/database.types'
import { useAuth } from './useAuth'

export function RoleGuard({ roles, children, fallback = null }: { roles: AppRole[]; children: ReactNode; fallback?: ReactNode }) {
  const { role, isMockMode } = useAuth()
  if (isMockMode) return children
  return role && roles.includes(role) ? children : fallback
}
