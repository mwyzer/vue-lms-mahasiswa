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

  const dm = config.public.demoMode
  const isDemo = dm === true || dm === 'true'

  let supabase: SupabaseClient

  if (isDemo) {
    // Demo mode: create a minimal stub client.
    // In demo mode, all data is managed by Pinia stores.
    supabase = createClient(
      config.public.supabaseUrl || 'https://demo.supabase.co',
      config.public.supabaseKey || 'demo-key'
    )
  } else if (!config.public.supabaseUrl || !config.public.supabaseKey) {
    // Production mode without credentials — create a stub that throws
    // so store init() catch blocks can fall back to demo data.
    console.warn(
      'Supabase URL and Key not configured. ' +
      'Set NUXT_PUBLIC_DEMO_MODE=true for demo mode, ' +
      'or provide NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_KEY.'
    )
    supabase = createClient('https://demo.supabase.co', 'demo-key')
  } else {
    // Production: real Supabase connection
    supabase = createClient(
      config.public.supabaseUrl,
      config.public.supabaseKey
    )
  }

  return {
    provide: {
      supabase,
    },
  }
})
