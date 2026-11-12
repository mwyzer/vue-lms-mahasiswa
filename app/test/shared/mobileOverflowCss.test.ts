/**
 * Guard tests for the mobile horizontal-overflow fix (prioritas 3b-C).
 *
 * The root cause was flex items in the layouts (`.main-area`, `.content`) keeping
 * their default `min-width: auto`, so a wide table widened the whole page on phones.
 * These static checks keep that fix — and the shared `.table-scroll` wrapper — from
 * silently regressing. The real browser audit lives in scripts/audit-mobile-overflow.mjs.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

/** Return the declarations of the first top-level rule whose selector is exactly `selector`. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))
  return m ? m[1]! : ''
}

describe('global .table-scroll utility', () => {
  const css = read('app/assets/css/main.css')

  it('scrolls horizontally inside its own box and never exceeds its parent', () => {
    const body = ruleBody(css, '.table-scroll')
    expect(body).toMatch(/overflow-x:\s*auto/)
    expect(body).toMatch(/max-width:\s*100%/)
    expect(body).toMatch(/min-width:\s*0/)
  })

  it('does not hardcode colors (theme-safe)', () => {
    const body = ruleBody(css, '.table-scroll')
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|oklch\(/i)
  })
})

describe('layouts let the main content shrink (min-width: 0)', () => {
  for (const layout of ['dashboard', 'instructor', 'admin']) {
    it(`${layout}.vue: .main-area and .content have min-width: 0`, () => {
      const src = read(`app/layouts/${layout}.vue`)
      expect(ruleBody(src, '.main-area')).toMatch(/min-width:\s*0/)
      expect(ruleBody(src, '.content')).toMatch(/min-width:\s*0/)
    })
  }

  it('default.vue: .layout-main has min-width: 0', () => {
    expect(ruleBody(read('app/layouts/default.vue'), '.layout-main')).toMatch(/min-width:\s*0/)
  })
})

describe('wide tables are wrapped in .table-scroll', () => {
  const files = [
    'app/pages/instructor/courses/[id]/gradebook.vue',
    'app/pages/instructor/courses/[id]/analytics.vue',
    'app/components/atRisk/AtRiskDashboard.vue',
    'app/components/importExport/ImportExportPanel.vue',
  ]
  for (const f of files) {
    it(f, () => {
      const src = read(f)
      const tables = src.match(/<table\b/g) ?? []
      expect(tables.length).toBeGreaterThan(0)
      // Every <table> is directly preceded by an opening wrapper carrying .table-scroll.
      const wrapped = src.match(/class="[^"]*\btable-scroll\b[^"]*">\s*<table\b/g) ?? []
      expect(wrapped.length).toBe(tables.length)
    })
  }
})
