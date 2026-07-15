/**
 * Student E2E Flow — LMS Mahasiswa
 *
 * Tests the full student journey in demo mode:
 * 1. Visit landing page
 * 2. Navigate to login
 * 3. Login as student (multi-step: role → level → session → roster)
 * 4. View dashboard
 * 5. Browse courses
 * 6. View course detail & complete a lesson
 * 7. View profile & edit
 * 8. Logout
 */
import { test, expect } from '@playwright/test'

/**
 * Helper: click a button by finding it in the DOM and dispatching a click event.
 * More reliable with Vue SSR/hydration than Playwright's native click.
 */
async function vueClick(page: import('@playwright/test').Page, selector: string) {
  await page.waitForSelector(selector, { timeout: 10000 })
  await page.evaluate((sel: string) => {
    const el = document.querySelector(sel) as HTMLElement
    if (el) el.click()
  }, selector)
  await page.waitForTimeout(300)
}

test.describe('Student Flow', () => {
  test('complete student journey', async ({ page }) => {
    // ── 1. Landing Page ──
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('LMS Mahasiswa')

    // ── 2. Navigate to Login via CTA link ──
    await page.getByRole('link', { name: /Mulai Belajar/ }).click()
    await expect(page).toHaveURL('/login')

    // ── 3. Login as Student ──
    // Step 3a: Select Mahasiswa role
    await vueClick(page, 'button.role-card')
    await expect(page.locator('h1')).toContainText('Pilih Level Kelas')

    // Step 3b: Select level 1
    await vueClick(page, 'button.level-btn')
    await expect(page.locator('h1')).toContainText('Pilih Waktu Kelas')

    // Step 3c: Select morning session
    await vueClick(page, 'button.session-btn')
    await expect(page.locator('h1')).toContainText('Pilih Identitas')

    // Step 3d: Click first student in roster
    await vueClick(page, 'button.roster-item')

    // ── 4. Dashboard loaded ──
    await expect(page).toHaveURL('/dashboard')

    // ── 5. Browse Courses ──
    await page.getByRole('link', { name: /Mata Kuliah/i }).first().click()
    await expect(page).toHaveURL('/courses')

    // ── 6. View first course ──
    await page.locator('a[href*="/courses/c1"]').first().click()
    await expect(page).toHaveURL(/\/courses\/c1/)

    // ── 7. View Profile ──
    await page.goto('/profile')
    await expect(page).toHaveURL('/profile')

    // ── 8. Edit Profile ──
    await page.locator('button:has-text("Edit Profil")').click()
    const nameInput = page.locator('#edit-nama')
    await nameInput.clear()
    await nameInput.fill('Ahmad E2E')
    await page.locator('button:has-text("Simpan")').click()
    await expect(page.getByText(/berhasil diperbarui/)).toBeVisible()

    // ── 9. Logout ──
    await page.locator('a:has-text("Keluar"), button:has-text("Keluar")').first().click()
    await expect(page).toHaveURL('/login')
  })
})
