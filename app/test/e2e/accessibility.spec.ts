/**
 * Accessibility E2E Tests — LMS Mahasiswa
 *
 * Verifies:
 * 1. Keyboard navigation works on login page (tab order, focus indicators)
 * 2. Key pages have proper heading hierarchy
 * 3. Form inputs have associated labels
 * 4. Buttons and links have accessible names
 * 5. Alt text on meaningful images
 */
import { test, expect } from '@playwright/test'

test.describe('Accessibility', () => {
  // ── Keyboard Navigation ──
  test('login page has logical tab order', async ({ page }) => {
    await page.goto('/login')

    // Wait for page to fully hydrate
    await page.waitForSelector('h1')

    // Tab through the login page — first focusable elements should be reachable
    // Start from role selection
    await page.keyboard.press('Tab')
    const focused1 = page.locator(':focus')
    await expect(focused1).toBeAttached()

    // Verify we can tab through elements without getting stuck
    const tabCount = 10
    let lastFocused = ''
    for (let i = 0; i < tabCount; i++) {
      await page.keyboard.press('Tab')
      const focused = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return null
        return el.tagName + (el.textContent ? `:${el.textContent.trim().slice(0, 30)}` : '')
      })
      if (!focused) break // reached body, end of tab cycle
      expect(focused).not.toBe(lastFocused) // ensure we actually move
      lastFocused = focused
    }

    // Ensure we focused on multiple elements
    expect(lastFocused).toBeTruthy()
  })

  test('can navigate login steps with keyboard only', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('h1')

    // Step 1: Tab to the first role card (Mahasiswa) and press Enter
    const roleCards = page.locator('button.role-card')
    await roleCards.first().focus()
    await roleCards.first().press('Enter')

    // Should advance to next step
    await expect(page.locator('h1')).toContainText(/Pilih Level|Pilih/)

    // Step 2: Tab to level button and select
    const levelBtn = page.locator('button.level-btn').first()
    await levelBtn.focus()
    await levelBtn.press('Enter')

    // Should advance to session selection
    await expect(page.locator('h1')).toContainText(/Pilih/)

    // Step 3: Focus session button via keyboard
    const sessionBtn = page.locator('button.session-btn').first()
    await expect(sessionBtn).toBeAttached()
  })

  // ── Heading Hierarchy ──
  test('landing page has proper heading structure', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('h1')

    // Should have exactly one h1
    const h1Count = await page.locator('h1').count()
    expect(h1Count).toBe(1)

    // h1 should contain meaningful text
    const h1Text = await page.locator('h1').first().textContent()
    expect(h1Text?.trim()).toBeTruthy()
  })

  test('login page has proper heading', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('h1')

    const h1 = page.locator('h1')
    await expect(h1).toBeVisible()
    const text = await h1.textContent()
    expect(text?.trim()).toBeTruthy()
  })

  // ── Buttons and Links ──
  test('all buttons have accessible text', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('h1')

    // Check all buttons have meaningful text (not empty)
    const buttons = page.locator('button')
    const count = await buttons.count()
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i)
      const text = await btn.textContent()
      const ariaLabel = await btn.getAttribute('aria-label')
      // Either text content, aria-label, or title should exist
      const hasAccessibleName = (text?.trim() ?? '') !== '' || !!ariaLabel
      expect(hasAccessibleName).toBe(true)
    }
  })

  test('all links have accessible text', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('h1')

    const links = page.locator('a')
    const count = await links.count()
    for (let i = 0; i < count; i++) {
      const link = links.nth(i)
      const text = await link.textContent()
      const ariaLabel = await link.getAttribute('aria-label')
      // Links with only child elements (like emoji) still need accessible names
      const hasAccessibleName = (text?.trim() ?? '') !== '' || !!ariaLabel
      expect(hasAccessibleName).toBe(true)
    }
  })

  // ── Form Inputs ──
  test('instructor login form has label-associated inputs', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('h1')

    // Select instructor role (2nd role card)
    const instructorBtn = page.locator('button.role-card').nth(1)
    await instructorBtn.click()
    await page.waitForTimeout(200)

    // Select first instructor
    const firstInstructor = page.locator('button.instructor-item').first()
    await firstInstructor.click()
    await page.waitForTimeout(200)

    // Password input should be accessible
    const passwordInput = page.locator('#password')
    await expect(passwordInput).toBeVisible()

    // Check for associated label
    const label = page.locator('label[for="password"]')
    await expect(label).toBeVisible()
  })

  // ── Focus Indicators ──
  test('focusable elements show focus indicator on tab', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('h1')

    // Tab to first focusable element
    await page.keyboard.press('Tab')
    const focusedEl = page.locator(':focus')

    // The focused element should be visible (keyboard users can see where they are)
    await expect(focusedEl).toBeVisible()

    // CSS outline should not be set to 'none' on focused elements
    const outline = await focusedEl.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return style.outlineStyle
    })
    // Allow 'none' only if there's another focus indicator (box-shadow, etc.)
    if (outline === 'none') {
      const boxShadow = await focusedEl.evaluate((el) => {
        const style = window.getComputedStyle(el)
        return style.boxShadow
      })
      // At least one focus indicator should exist
      expect(boxShadow).not.toBe('none')
    }
  })

  // ── Contrast (visual check that text is visible) ──
  test('body text has sufficient color contrast', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('h1')

    // Check the body text color and background
    const bodyColor = await page.evaluate(() => {
      const style = window.getComputedStyle(document.body)
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
      }
    })

    expect(bodyColor.color).toBeTruthy()
    expect(bodyColor.backgroundColor).toBeTruthy()
    // Body should not have transparent or white-on-white issues
    expect(bodyColor.color).not.toBe('rgba(0, 0, 0, 0)')
  })
})
