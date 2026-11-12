#!/usr/bin/env node
/**
 * audit-mobile-overflow.mjs — Audit horizontal overflow on table/wide pages.
 *
 * Logs in as the demo student / instructor / admin, opens every page in the
 * list below at the given viewport width, and measures:
 *   - document.documentElement.scrollWidth > clientWidth (page-level overflow)
 *   - the widest elements whose right edge exceeds the viewport and that are
 *     NOT clipped by a horizontally scrolling/hidden ancestor.
 *
 * Usage (needs a running app, e.g. `npm run dev` or `npx nuxt preview`):
 *   node scripts/audit-mobile-overflow.mjs                # 390px
 *   node scripts/audit-mobile-overflow.mjs --width=360 --width=414 --width=1280
 *   node scripts/audit-mobile-overflow.mjs --dark --json=out.json --strict
 *
 * Env: BASE_URL (default http://localhost:3000), CHROME_PATH (optional
 * executable; otherwise Playwright's bundled Chromium or the "chrome" channel).
 * --strict exits 1 when any page overflows horizontally.
 */
import { chromium } from '@playwright/test'
import { existsSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const widths = args.filter(a => a.startsWith('--width=')).map(a => Number(a.slice(8))).filter(Boolean)
if (widths.length === 0) widths.push(390)
const dark = args.includes('--dark')
const strict = args.includes('--strict')
const jsonOut = args.find(a => a.startsWith('--json='))?.slice(7)
const only = args.find(a => a.startsWith('--only='))?.slice(7) // student|instructor|admin
const BASE = process.env.BASE_URL || 'http://localhost:3000'

/** Pages to audit, grouped per demo role. */
export const PAGES = {
  student: [
    '/dashboard',
    '/student/grades',
    '/assignments',
    '/quiz',
    '/student/attendance',
    '/calendar',
    '/courses/c1/forum',
  ],
  instructor: [
    '/instructor/courses/c1/gradebook',
    '/instructor/assignments',
    '/instructor/courses/c1/assignments',
    '/instructor/quiz',
    '/instructor/courses/c1/quiz',
    '/instructor/attendance',
    '/instructor/courses/c1/attendance',
    '/instructor/at-risk',
    '/instructor/import-export',
    '/instructor/courses/c1/analytics',
    '/instructor/courses/c1/forum',
    '/instructor/students',
    '/calendar',
  ],
  admin: [
    '/admin/dashboard',
    '/admin/students',
    '/admin/instructors',
    '/admin/courses',
    '/admin/campuses',
    '/admin/assignments',
    '/admin/quiz',
    '/admin/at-risk',
    '/admin/import-export',
  ],
}

async function domClick(page, selector, index = 0) {
  await page.waitForSelector(selector, { timeout: 15000 })
  await page.evaluate(({ sel, idx }) => {
    const els = document.querySelectorAll(sel)
    if (els[idx]) els[idx].click()
  }, { sel: selector, idx: index })
  await page.waitForTimeout(300)
}

async function typePassword(page, pwd) {
  const input = page.locator('.password-form input').first()
  await input.waitFor({ timeout: 15000 })
  await input.fill(pwd)
  await page.locator('.password-form button.btn-primary').first().click()
}

async function login(page, role) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.waitForSelector('button.role-card')
  await page.waitForTimeout(500) // hydration
  if (role === 'student') {
    await domClick(page, 'button.role-card', 0)
    await domClick(page, 'button.level-btn')
    await domClick(page, 'button.session-btn')
    await domClick(page, 'button.roster-item')
    await typePassword(page, 'mahasiswa123')
    await page.waitForURL(/\/dashboard/, { timeout: 20000 })
  } else if (role === 'instructor') {
    await domClick(page, 'button.role-card', 1)
    await domClick(page, 'button.instructor-item')
    await typePassword(page, 'instruktur123')
    await page.waitForURL(/\/instructor\/dashboard/, { timeout: 20000 })
  } else {
    await domClick(page, 'button.role-card', 2)
    await typePassword(page, 'admin123')
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 })
  }
}

/** Runs in the page: measure page overflow and list unclipped offenders. */
function measure() {
  const de = document.documentElement
  const vw = de.clientWidth
  const describe = (el) => {
    let s = el.tagName.toLowerCase()
    if (el.id) s += `#${el.id}`
    const cls = [...el.classList].filter(c => !c.startsWith('data-v-')).slice(0, 2)
    if (cls.length) s += `.${cls.join('.')}`
    return s
  }
  const clippedByAncestor = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') {
        if (p.getBoundingClientRect().right <= vw + 1) return true
      }
    }
    return false
  }
  const offenders = []
  for (const el of document.body.querySelectorAll('*')) {
    const st = getComputedStyle(el)
    if (st.position === 'fixed' || st.display === 'none' || st.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.right <= vw + 1 || r.left >= vw) continue
    if (clippedByAncestor(el)) continue
    offenders.push({ node: el, el: describe(el), right: Math.round(r.right), width: Math.round(r.width) })
  }
  // Culprits: the deepest "wide" offenders (no child is itself wide). When a flex shell
  // grows, every wrapper grows with it, so the deepest wide box is the real cause
  // (e.g. a <table> or a grid with fixed columns).
  const wide = offenders.filter(o => o.width > vw * 0.9)
  const wideSet = new Set(wide.map(o => o.node))
  const culprits = wide.filter(o => ![...o.node.children].some(c => wideSet.has(c)))
  culprits.sort((a, b) => b.right - a.right)
  return {
    scrollWidth: de.scrollWidth,
    clientWidth: vw,
    overflow: de.scrollWidth > vw,
    offenderCount: offenders.length,
    top: culprits.slice(0, 4).map(o => `${o.el}(${o.right}px)`),
  }
}

function resolveLaunch() {
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH }
  if (existsSync('/usr/bin/google-chrome')) return { executablePath: '/usr/bin/google-chrome' }
  return {}
}

async function main() {
  const browser = await chromium.launch({ headless: true, ...resolveLaunch() })
  const results = []
  try {
    for (const width of widths) {
      for (const [role, routes] of Object.entries(PAGES)) {
        if (only && only !== role) continue
        const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: dark ? 'dark' : 'light' })
        const page = await ctx.newPage()
        try {
          await login(page, role)
        } catch (e) {
          console.error(`[${role}] login gagal: ${e.message}`)
          await ctx.close()
          continue
        }
        for (const route of routes) {
          let row
          try {
            try {
              await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 })
            } catch {
              // e.g. ERR_ABORTED when a client redirect races the navigation — retry once.
              await page.waitForTimeout(1000)
              await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 })
            }
            await page.waitForTimeout(800)
            if (dark) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
            row = { width, role, route, ...(await page.evaluate(measure)) }
          } catch (e) {
            row = { width, role, route, error: e.message.split('\n')[0] }
          }
          results.push(row)
          const flag = row.error ? 'ERR ' : row.overflow ? 'OVER' : 'ok  '
          console.log(`${flag} ${width}px ${role.padEnd(10)} ${route.padEnd(36)} ${row.error ?? `${row.scrollWidth}/${row.clientWidth}  ${row.top.join(' ')}`}`)
        }
        await ctx.close()
      }
    }
  } finally {
    await browser.close()
  }
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 2))
  const over = results.filter(r => r.overflow)
  console.log(`\n${results.length} halaman diaudit, ${over.length} overflow, ${results.filter(r => r.error).length} error.`)
  if (strict && (over.length || results.some(r => r.error))) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(2) })
