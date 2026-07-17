// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-07-14',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@vite-pwa/nuxt', '@vuestic/nuxt'],

  components: {
    dirs: [
      { path: '~/components', pathPrefix: false }
    ]
  },

  vuestic: {
    config: {
      // Colors aligned with existing LMS design tokens
      colors: {
        variables: {
          primary: '#2563eb',
          secondary: '#475569',
          success: '#22c55e',
          info: '#3b82f6',
          danger: '#ef4444',
          warning: '#f59e0b',
          dark: '#0f172a',
          background: '#f8fafc',
          surface: '#ffffff',
        },
      },
    },
    css: ['typography', 'reset'],
  },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'LMS Mahasiswa',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#2563eb' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'LMS Mahasiswa' }
      ],
      link: [
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/icon_32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/icons/icon_16x16.png' },
        { rel: 'mask-icon', href: '/icons/icon_512x512.png', color: '#2563eb' }
      ]
    }
  },

  pwa: {
    registerType: 'autoUpdate',
    includeAssets: ['fonts/*', 'robots.txt'],
    manifest: {
      name: 'LMS Mahasiswa',
      short_name: 'LMS',
      description: 'Learning Management System untuk Mahasiswa',
      theme_color: '#2563eb',
      background_color: '#ffffff',
      display: 'standalone',
      scope: '/',
      start_url: '/',
      orientation: 'portrait-primary',
      icons: [
        { src: '/icons/icon_192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon_512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon_512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fmibyazumfxrgcehojys\.supabase\.co\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'supabase-api',
            expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            networkTimeoutSeconds: 10
          }
        }
      ]
    },
    client: {
      installPrompt: true,
      periodicSyncForUpdates: 60 * 60
    }
  },

  typescript: {
    strict: true
  },

  nitro: {
    preset: 'vercel'
  },

  srcDir: 'app/',

  imports: {
    dirs: ['stores', 'composables', 'types']
  },

  runtimeConfig: {
    // Server-only (not exposed to client)
    aiApiKey: '',
    aiModel: 'gpt-4o-mini',

    public: {
      supabaseUrl: 'https://fmibyazumfxrgcehojys.supabase.co',
      supabaseKey: 'sb_publishable_YcNaRX89fTgNKA91A7Cw5w_q5HUozdQ',
      demoMode: 'false',
      appName: 'LMS Mahasiswa',
      appUrl: 'http://localhost:3000',
      aiModel: 'gpt-4o-mini'
    }
  }
})
