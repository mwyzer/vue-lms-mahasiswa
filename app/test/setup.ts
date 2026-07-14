/**
 * Test setup for Vitest + Pinia + Nuxt mocks.
 *
 * Provides mocked versions of Nuxt auto-imports used by stores:
 * - useRuntimeConfig()
 * - useNuxtApp()
 * - navigateTo()
 * - defineStore() (via #imports)
 */
import { vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ── Mock Nuxt auto-imports as globals ──
// Nuxt auto-imports are available as globals at runtime.
// We set them on globalThis so store files can access them without explicit imports.

const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
}

// Mock useRuntimeConfig to return demo mode
globalThis.useRuntimeConfig = vi.fn(() => ({
  public: {
    supabaseUrl: 'https://fmibyazumfxrgcehojys.supabase.co',
    supabaseKey: 'sb_publishable_YcNaRX89fTgNKA91A7Cw5w_q5HUozdQ',
    demoMode: 'true',
    appName: 'LMS Mahasiswa',
    appUrl: 'http://localhost:3000',
  },
}))

globalThis.navigateTo = vi.fn()

globalThis.useNuxtApp = vi.fn(() => ({
  $supabase: mockSupabaseClient,
}))

// ── Auto-create fresh Pinia before each test ──
beforeEach(() => {
  setActivePinia(createPinia())
})
