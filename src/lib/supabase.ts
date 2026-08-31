import { createClient } from '@supabase/supabase-js'
import { env, hasSupabaseConfiguration } from '../config/env'

/**
 * Cliente preparado para uso futuro. Sem variáveis, permanece nulo e nenhuma
 * conexão é iniciada. Nunca use uma service_role/secret key no frontend.
 */
export const supabase = hasSupabaseConfiguration
  ? createClient(env.supabaseUrl, env.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
