import { test, expect } from '@playwright/test'
import { setupAdminForTest, hasAdminMfaCredentials } from './helpers/auth'

const needsAdmin = () => test.skip(!hasAdminMfaCredentials(), 'E2E admin MFA credentials not configured')

const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const createName = () => `E2E Sponsor ${Date.now()}`

test.describe('Admin Sponsor — logo upload', () => {
  needsAdmin()

  test.beforeEach(async ({ page }) => {
    await setupAdminForTest(page, '/admin/dashboard/sponsor')
  })

  test('creates a sponsor uploading a logo from PC', async ({ page }) => {
    const name = createName()

    await page.getByRole('button', { name: 'Nuovo Sponsor' }).click()
    await page.locator('input').first().fill(name)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    })
    await page.getByRole('button', { name: 'Crea' }).click()

    const row = page.locator('tr', { hasText: name })
    await expect(row.getByRole('cell', { name }).first()).toBeVisible()

    const img = row.locator('img').first()
    await expect(img).toHaveAttribute('src', /\/storage\/v1\/object\/public\/sponsor-logos\//)

    // Cleanup
    page.once('dialog', (d) => d.accept())
    await row.getByRole('button', { name: 'ELIMINA' }).click()
    await expect(page.getByRole('cell', { name })).toHaveCount(0)
  })

  test('rejects an unsupported file type', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuovo Sponsor' }).click()
    await page.locator('input[type="file"]').setInputFiles({
      name: 'logo.gif',
      mimeType: 'image/gif',
      buffer: Buffer.from('GIF89a'),
    })
    await expect(page.getByText('Formato immagine non supportato. Usa PNG, JPG, JPEG, WEBP o SVG')).toBeVisible()
  })
})
