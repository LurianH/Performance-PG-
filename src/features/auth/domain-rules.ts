import type { AppRole } from '../../types/database.types'

export function hasOperationalAccess(active: boolean, role: AppRole | null): boolean {
  return active && role !== null
}

export function hasAllowedRole(role: AppRole | null, allowedRoles?: AppRole[]): boolean {
  return role !== null && (!allowedRoles || allowedRoles.includes(role))
}
