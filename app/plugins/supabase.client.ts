/**
 * Supabase client plugin.
 *
 * In demo mode (default), this provides a minimal stub so the app
 * runs fully without a backend. In production, replace with real
 * Supabase client initialization.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const isDemo = config.public.demoMode === 'true'

  let supabase: SupabaseClient

  if (isDemo) {
    // Demo mode: create a minimal stub client
    // In demo mode, all data is managed by Pinia stores
    supabase = createClient(
      config.public.supabaseUrl || 'https://demo.supabase.co',
      config.public.supabaseKey || 'demo-key'
    )
  } else {
    // Production: real Supabase connection
    const url = config.public.supabaseUrl
    const key = config.public.supabaseKey

    if (!url || !key) {
      console.error(
        'Supabase URL and Key must be defined in .env for production mode. ' +
        'Set NUXT_PUBLIC_DEMO_MODE=true for demo mode.'
      )
    }

    supabase = createClient(url || '', key || '')
  }

  return {
    provide: {
      supabase,
    },
  }
})
