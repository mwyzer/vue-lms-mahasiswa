/**
 * Vuestic UI Configuration
 *
 * Defines global component defaults, icon config, and color presets
 * aligned with the LMS Mahasiswa design system.
 *
 * @see https://ui.vuestic.dev/getting-started/nuxt#vuesticconfigts
 */
import { defineVuesticConfig } from 'vuestic-ui'

export default defineVuesticConfig({
  colors: {
    // Light theme (default) — matches :root tokens in main.css
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
      'text-primary': '#1e293b',
      'text-secondary': '#64748b',
    },

    // Presets allow runtime theme switching via useColors().applyPreset()
    presets: {
      light: {
        primary: '#2563eb',
        secondary: '#475569',
        success: '#22c55e',
        info: '#3b82f6',
        danger: '#ef4444',
        warning: '#f59e0b',
        dark: '#0f172a',
        background: '#f8fafc',
        surface: '#ffffff',
        'text-primary': '#1e293b',
        'text-secondary': '#64748b',
      },
      dark: {
        primary: '#60a5fa',
        secondary: '#94a3b8',
        success: '#4ade80',
        info: '#60a5fa',
        danger: '#f87171',
        warning: '#fbbf24',
        dark: '#e2e8f0',
        background: '#0f172a',
        surface: '#1e293b',
        'text-primary': '#f1f5f9',
        'text-secondary': '#94a3b8',
      },
    },
  },

  components: {
    VaButton: {
      size: 'medium',
      round: false,
    },
    VaInput: {
      outline: true,
    },
    VaCard: {
      outlined: true,
    },
  },

  breakpoints: {
    thresholds: {
      xs: 0,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },
})
