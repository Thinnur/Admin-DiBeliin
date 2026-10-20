import { test as base, expect, type Page } from '@playwright/test';
import { readOnlyGuard } from './guard';

// Smoke test + screenshot pembanding untuk refactor performa web admin.
// Data diputar ulang dari HAR (e2e/har/, rekam ulang: npm run test:smoke:rekam) supaya screenshot stabil.
// HAR, screenshot, dan trace berisi data pelanggan/keuangan produksi: SEMUANYA di-gitignore, hanya di VPS.
const UPDATE_HAR = process.env.UPDATE_HAR === '1';

const test = base.extend<{ guard: void }>({
  guard: [async ({ page }, use, testInfo) => {
    const ctx = page.context();
    const harName = testInfo.titlePath.slice(1).join(' ').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    await ctx.routeFromHAR(`e2e/har/${harName}.zip`, {
      url: /\/rest\/v1\/|\/storage\/v1\//,
      update: UPDATE_HAR,
      updateMode: 'minimal',
      notFound: 'fallback',
    });
    // Didaftar SETELAH HAR supaya jalan duluan: saat merekam pun request tulis tak sempat lolos ke server.
    const blocked = await readOnlyGuard(ctx);
    await page.clock.setFixedTime(new Date('2026-10-20T10:00:00+07:00'));

    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
    await use();
    expect(blocked, 'request tulis yang dicegah').toEqual([]);
    expect(errors, 'error di browser').toEqual([]);
  }, { auto: true }],
});

// Screenshot 2000 px teratas lewat viewport tinggi. JANGAN fullPage: /outlets tingginya ±164.000 px
// (semua outlet dirender) = gambar >1 GB di RAM VPS produksi.
async function snap(page: Page) {
  await page.setViewportSize({ width: 412, height: 2000 });
  await expect(page).toHaveScreenshot({ timeout: 20_000 });
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

const PAGES = [
  '/inventory',
  '/calculator',
  '/checkout-history',
  '/operational',
  '/finance',
  '/outlets',
  '/menus',
  '/digital-products',
  '/digital-tracking',
  '/digital-providers',
];

for (const path of PAGES) {
  test(`halaman ${path}`, async ({ page }) => {
    await page.goto(path);
    await settle(page);
    await expect(page).toHaveURL(new RegExp(`${path}$`)); // tidak dilempar ke /login atau /inventory
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
    await snap(page);
  });
}

test('outlets: paginasi', async ({ page }) => {
  await page.goto('/outlets');
  const pager = page.getByText(/^Hal \d+ \/ \d+$/);
  const firstOutlet = page.getByText('Bandar Agung').filter({ visible: true });
  await expect(pager).toHaveText(/^Hal 1 \//);
  await expect(firstOutlet).toBeVisible();
  await page.getByRole('button', { name: 'Berikutnya' }).click();
  await expect(pager).toHaveText(/^Hal 2 \//);
  await expect(firstOutlet).toHaveCount(0);
  await page.getByPlaceholder('Search outlets by name...').fill('a'); // filter berubah -> kembali ke halaman 1
  await expect(pager).toHaveText(/^Hal 1 \//);
});

test.describe('tanpa login', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('halaman login', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await settle(page);
    await snap(page);
  });
});
