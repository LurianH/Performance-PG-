export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.trim() ?? '',
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '',
}

export const hasSupabaseConfiguration = Boolean(
  env.supabaseUrl && env.supabasePublishableKey,
)
