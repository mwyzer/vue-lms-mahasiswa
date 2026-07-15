/**
 * Instructor E2E Flow — LMS Mahasiswa
 *
 * Tests the full instructor journey:
 * 1. Login as instructor (multi-step: role → pick name → password)
 * 2. View dashboard
 * 3. Browse courses & view detail
 * 4. View students
 * 5. View & edit profile
 * 6. Logout
 */
import { test, expect } from '@playwright/test'

/**
 * Helper: click a button by finding it in the DOM and dispatching a click event.
 * More reliable with Vue SSR/hydration than Playwright's native click.
 */
async function vueClick(page: import('@playwright/test').Page, selector: string, index = 0) {
  await page.waitForSelector(selector, { timeout: 10000 })
  await page.evaluate(({ sel, idx }: { sel: string; idx: number }) => {
    const els = document.querySelectorAll(sel) as NodeListOf<HTMLElement>
    if (els[idx]) els[idx].click()
  }, { sel: selector, idx: index })
  await page.waitForTimeout(300)
}

test.describe('Instructor Flow', () => {
  test('complete instructor journey', async ({ page }) => {
    // ── 1. Login as Instructor ──
    await page.goto('/login')
    await expect(page.locator('h1')).toContainText('Masuk ke LMS')

    // Step: Select instructor role (2nd role card)
    await vueClick(page, 'button.role-card', 1)
    await expect(page.locator('h1')).toContainText('Pilih Instruktur')

    // Step: Pick first instructor (Dr. Andi Wijaya, M.Kom.)
    await vueClick(page, 'button.instructor-item')
    await expect(page.locator('h1')).toContainText('Selamat datang')

    // Step: Enter password
    const passwordInput = page.locator('#password')
    await passwordInput.fill('instruktur123')
    await page.locator('button[type="submit"]').click()

    // ── 2. Instructor Dashboard ──
    await expect(page).toHaveURL('/instructor/dashboard')

    // ── 3. Browse Courses ──
    await page.getByRole('link', { name: /Mata Kuliah/i }).first().click()
    await expect(page).toHaveURL('/instructor/courses')

    // ── 4. View first course ──
    await page.locator('a[href*="/instructor/courses/c1"]').first().click()
    await expect(page).toHaveURL(/\/instructor\/courses\/c1/)

    // ── 5. View Students ──
    await page.getByRole('link', { name: /Mahasiswa/i }).first().click()
    await expect(page).toHaveURL('/instructor/students')

    // ── 6. View Profile ──
    await page.getByRole('link', { name: /Profil/i }).first().click()
    await expect(page).toHaveURL('/instructor/profile')

    // ── 7. Edit Profile ──
    await page.locator('button:has-text("Edit Profil")').click()
    const nameInput = page.locator('#edit-nama')
    await nameInput.clear()
    await nameInput.fill('Dr. Andi E2E')
    await page.locator('button:has-text("Simpan")').click()
    await expect(page.getByText(/berhasil diperbarui/)).toBeVisible()

    // ── 8. Logout ──
    await page.locator('a:has-text("Keluar"), button:has-text("Keluar")').first().click()
    await expect(page).toHaveURL('/login')
  })
})
