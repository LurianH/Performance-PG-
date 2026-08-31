import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { AppRole, ProfileRow } from '../../types/database.types'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: ProfileRow | null
  role: AppRole | null
  loading: boolean
  isMockMode: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
