/**
 * Minimal E2E test – login page button click verification.
 * Run with: npx playwright test app/test/e2e/debug.spec.ts
 */
import { test, expect } from '@playwright/test'

test('click mahasiswa button changes h1', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', err => errors.push(err.message))
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console-error: ${msg.text()}`)
  })

  await page.goto('/login', { waitUntil: 'networkidle' })
  
  // Wait for Vue to mount
  await page.waitForTimeout(3000)
  
  // Debug: get page text
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500))
  console.log('Page text:', bodyText)
  
  // Try to click Mahasiswa button
  const btn = page.locator('button.role-card').first()
  const exists = await btn.count()
  console.log('Button exists:', exists, 'text:', await btn.textContent())
  console.log('HTML of button:', await page.evaluate(() => {
    const b = document.querySelector('button.role-card')
    return b ? b.outerHTML : 'not found'
  }))
  
  await btn.click()
  await page.waitForTimeout(1000)
  
  const h1 = await page.locator('h1').textContent()
  console.log('h1:', h1)
  console.log('Errors:', errors)
  
  expect(h1).toContain('Pilih Level Kelas')
})
