# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: student-flow.spec.ts >> Student Flow >> complete student journey
- Location: app\test\e2e\student-flow.spec.ts:30:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h1')
Expected substring: "Pilih Level Kelas"
Received string:    "Masuk ke LMS"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('h1')
    14 × locator resolved to <h1 data-v-e8ce220f="">Masuk ke LMS</h1>
       - unexpected value "Masuk ke LMS"

```

```yaml
- heading "Masuk ke LMS" [level=1]
```

# Test source

```ts
  1  | /**
  2  |  * Student E2E Flow — LMS Mahasiswa
  3  |  *
  4  |  * Tests the full student journey in demo mode:
  5  |  * 1. Visit landing page
  6  |  * 2. Navigate to login
  7  |  * 3. Login as student (multi-step: role → level → session → roster)
  8  |  * 4. View dashboard
  9  |  * 5. Browse courses
  10 |  * 6. View course detail & complete a lesson
  11 |  * 7. View profile & edit
  12 |  * 8. Logout
  13 |  */
  14 | import { test, expect } from '@playwright/test'
  15 | 
  16 | /**
  17 |  * Helper: click a button by finding it in the DOM and dispatching a click event.
  18 |  * More reliable with Vue SSR/hydration than Playwright's native click.
  19 |  */
  20 | async function vueClick(page: import('@playwright/test').Page, selector: string) {
  21 |   await page.waitForSelector(selector, { timeout: 10000 })
  22 |   await page.evaluate((sel: string) => {
  23 |     const el = document.querySelector(sel) as HTMLElement
  24 |     if (el) el.click()
  25 |   }, selector)
  26 |   await page.waitForTimeout(300)
  27 | }
  28 | 
  29 | test.describe('Student Flow', () => {
  30 |   test('complete student journey', async ({ page }) => {
  31 |     // ── 1. Landing Page ──
  32 |     await page.goto('/')
  33 |     await expect(page.locator('h1')).toContainText('LMS Mahasiswa')
  34 | 
  35 |     // ── 2. Navigate to Login via CTA link ──
  36 |     await page.getByRole('link', { name: /Mulai Belajar/ }).click()
  37 |     await expect(page).toHaveURL('/login')
  38 | 
  39 |     // ── 3. Login as Student ──
  40 |     // Step 3a: Select Mahasiswa role
  41 |     await vueClick(page, 'button.role-card')
> 42 |     await expect(page.locator('h1')).toContainText('Pilih Level Kelas')
     |                                      ^ Error: expect(locator).toContainText(expected) failed
  43 | 
  44 |     // Step 3b: Select level 1
  45 |     await vueClick(page, 'button.level-btn')
  46 |     await expect(page.locator('h1')).toContainText('Pilih Waktu Kelas')
  47 | 
  48 |     // Step 3c: Select morning session
  49 |     await vueClick(page, 'button.session-btn')
  50 |     await expect(page.locator('h1')).toContainText('Pilih Identitas')
  51 | 
  52 |     // Step 3d: Click first student in roster
  53 |     await vueClick(page, 'button.roster-item')
  54 | 
  55 |     // ── 4. Dashboard loaded ──
  56 |     await expect(page).toHaveURL('/dashboard')
  57 | 
  58 |     // ── 5. Browse Courses ──
  59 |     await page.getByRole('link', { name: /Mata Kuliah/i }).first().click()
  60 |     await expect(page).toHaveURL('/courses')
  61 | 
  62 |     // ── 6. View first course ──
  63 |     await page.locator('a[href*="/courses/c1"]').first().click()
  64 |     await expect(page).toHaveURL(/\/courses\/c1/)
  65 | 
  66 |     // ── 7. View Profile ──
  67 |     await page.goto('/profile')
  68 |     await expect(page).toHaveURL('/profile')
  69 | 
  70 |     // ── 8. Edit Profile ──
  71 |     await page.locator('button:has-text("Edit Profil")').click()
  72 |     const nameInput = page.locator('#edit-nama')
  73 |     await nameInput.clear()
  74 |     await nameInput.fill('Ahmad E2E')
  75 |     await page.locator('button:has-text("Simpan")').click()
  76 |     await expect(page.getByText(/berhasil diperbarui/)).toBeVisible()
  77 | 
  78 |     // ── 9. Logout ──
  79 |     await page.locator('a:has-text("Keluar"), button:has-text("Keluar")').first().click()
  80 |     await expect(page).toHaveURL('/login')
  81 |   })
  82 | })
  83 | 
```