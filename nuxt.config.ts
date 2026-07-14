// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-07-14',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt'],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'LMS Mahasiswa',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
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
    public: {
      supabaseUrl: 'https://fmibyazumfxrgcehojys.supabase.co',
      supabaseKey: 'pXfneEQMJBriwkob',
      demoMode: 'false',
      appName: 'LMS Mahasiswa',
      appUrl: 'http://localhost:3000'
    }
  }
})
