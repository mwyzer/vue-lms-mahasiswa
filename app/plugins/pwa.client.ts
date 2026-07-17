/**
 * PWA / Service Worker registration plugin.
 * Uses @vite-pwa/nuxt virtual module to detect SW updates
 * and notifies the UpdatePrompt component via a custom event.
 */
export default defineNuxtPlugin(async () => {
  if (!('serviceWorker' in navigator)) return

  const { registerSW } = await import('virtual:pwa-register')

  const updateSW = registerSW({
    onNeedRefresh() {
      // Dispatch custom event so UpdatePrompt can show the banner
      window.dispatchEvent(new CustomEvent('sw:update'))
    },
    onOfflineReady() {
      console.log('[PWA] App ready for offline use')
    },
    onRegistered(registration) {
      if (registration) {
        console.log('[PWA] Service worker registered:', registration.scope)
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Service worker registration error:', error)
    }
  })

  // Expose updateSW so UpdatePrompt can call it on user action
  window.__swUpdate = updateSW
})

// Type augmentation for the window property
declare global {
  interface Window {
    __swUpdate?: (immediate?: boolean) => Promise<void>
  }
}
