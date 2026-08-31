import type { AppRole } from '../../types/database.types'

export function hasOperationalAccess(active: boolean, role: AppRole | null): boolean {
  return active && role !== null
}
