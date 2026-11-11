/**
 * UI Store — theme handling
 *
 * The OS preference is applied but never saved; only an explicit choice
 * (toggle / setTheme) is persisted, so the app keeps following the OS until
 * the user picks a theme.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUiStore } from '~/stores/ui'

function mockSystemTheme(dark: boolean) {
  const listeners: Array<(e: { matches: boolean }) => void> = []
  window.matchMedia = vi.fn().mockReturnValue({
    matches: dark,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.push(cb),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia
  return { emit: (matches: boolean) => listeners.forEach((cb) => cb({ matches })) }
}

describe('ui store theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('follows the OS preference on first visit without saving it', () => {
    mockSystemTheme(true)
    const ui = useUiStore()
    ui.initTheme()
    expect(ui.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('lms-theme')).toBeNull()
  })

  it('keeps following OS changes until the user chooses a theme', () => {
    const system = mockSystemTheme(false)
    const ui = useUiStore()
    ui.initTheme()
    expect(ui.theme).toBe('light')

    system.emit(true)
    expect(ui.theme).toBe('dark')
    expect(localStorage.getItem('lms-theme')).toBeNull()

    ui.toggleTheme() // explicit choice: dark → light
    expect(ui.theme).toBe('light')
    expect(localStorage.getItem('lms-theme')).toBe('light')

    system.emit(true) // OS says dark, but the user chose light
    expect(ui.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('restores a saved choice over the OS preference', () => {
    localStorage.setItem('lms-theme', 'light')
    mockSystemTheme(true)
    const ui = useUiStore()
    ui.initTheme()
    expect(ui.theme).toBe('light')
  })

  it('ignores a corrupted saved value', () => {
    localStorage.setItem('lms-theme', 'purple')
    mockSystemTheme(true)
    const ui = useUiStore()
    ui.initTheme()
    expect(ui.theme).toBe('dark')
  })

  it('toggle flips the theme, updates the DOM and persists', () => {
    mockSystemTheme(false)
    const ui = useUiStore()
    ui.initTheme()
    ui.toggleTheme()
    expect(ui.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('lms-theme')).toBe('dark')
    ui.toggleTheme()
    expect(ui.theme).toBe('light')
    expect(localStorage.getItem('lms-theme')).toBe('light')
  })
})
