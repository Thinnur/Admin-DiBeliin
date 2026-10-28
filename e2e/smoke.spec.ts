/// <reference lib="dom" />
// (lib dom: sebagian tes menjalankan kode di dalam browser lewat page.evaluate)
import { test as base, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
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
  '/watermark',
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

test('menus: paginasi', async ({ page }) => {
  await page.goto('/menus');
  const pager = page.getByText(/^Hal \d+ \/ \d+$/);
  const firstCard = page.locator('div.md\\:hidden > div').first();
  await expect(pager).toHaveText(/^Hal 1 \//);
  const first = await firstCard.innerText();
  await page.getByRole('button', { name: 'Berikutnya' }).click();
  await expect(pager).toHaveText(/^Hal 2 \//);
  await expect(firstCard).not.toHaveText(first);
  await page.getByPlaceholder('Cari menu...').fill('a'); // filter berubah -> tabel di-remount, kembali ke halaman 1
  await expect(pager).toHaveText(/^Hal 1 \//);
});

test('watermark: foto diberi watermark lalu diunduh', async ({ page }) => {
  await page.goto('/watermark');
  await expect(page).toHaveURL(/\/watermark$/);
  // Foto uji 1600x1200 abu-abu polos, dibuat di browser supaya tak perlu berkas fixture.
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 1200;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, c.width, c.height);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'foto-uji.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.getByRole('img', { name: 'foto-uji.png' })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Unduh foto-uji.png' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('foto-uji-wm.jpg');
  const jpg = (await readFile(await download.path())).toString('base64');
  const hasil = await page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${b64}`)).blob());
    const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    const tengah = Array.from(ctx.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data.slice(0, 3));
    // Kuadran kiri atas (di luar logo): foto asli polos, jadi simpangan > 0 berarti pola latar ada.
    const d = ctx.getImageData(0, 0, bmp.width >> 2, bmp.height >> 2).data;
    let sum = 0, sq = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { sum += d[i]; sq += d[i] * d[i]; n++; }
    const mean = sum / n;
    return { w: bmp.width, h: bmp.height, tengah, std: Math.sqrt(sq / n - mean * mean) };
  }, jpg);
  expect([hasil.w, hasil.h]).toEqual([1080, 810]); // lebar maksimal bawaan 1080 px, rasio tetap
  expect(Math.max(...hasil.tengah.map((v) => Math.abs(v - 128)))).toBeGreaterThan(15); // logo di tengah
  expect(hasil.std).toBeGreaterThan(2); // pola samar di latar
});

test('struk Tomoro & Janji Jiwa: digambar lalu diunduh PNG', async ({ page }) => {
  // Job tiruan (bukan data produksi); result.struk berbentuk keluaran kopsu_status_worker.js.
  const job = (brand: string, struk: object) => ({
    id: `uji-${brand}`, status: 'success', log: [], created_by: null, receipt_refresh_requested_at: null, cancel_requested_at: null,
    created_at: '2026-10-20T03:00:00Z', updated_at: '2026-10-20T03:00:00Z',
    order_payload: { brand, outlet: 'Outlet Uji', name: 'Budi', items: [{ name: 'Kopi Uji', options: [] }], subtotal: 42000 },
    result: { orderId: `UJI-${brand}`, accountId: 1, accountName: 'Budi', paymentStatus: 'PAYMENT_SUCCESS', phase: 'Ambil Sekarang', pickupNo: '8015', statusLabel: 'Pickup', struk },
  });
  const jobs: Record<string, object> = {
    'uji-tomoro': job('tomoro', {
      v: 1, code: 'TO2026UJI', status: 4, takeFoodNo: '8015', statusRateCard: 'Your order is ready', pointNum: 0,
      storeName: 'SPBU Tendean', storeAddress: 'Jl. Kapten Tendean', paymentMoney: 21000, currencyUnit: 'Rp',
      createTime: 1792900000000, bizChannel: 'APP', payChannelName: 'DANA', note: null,
      items: [{ name: 'TOMORO Aren Latte', desc: 'Small, Iced', amount: 2, price: 21000, linePrice: 42000, image: null }],
      summary: [{ name: 'Subtotal', money: 42000, discount: false }, { name: 'Voucher (B1G1)', money: 21000, discount: true }],
    }),
    'uji-janjijiwa': job('janjijiwa', {
      v: 1, status: 'ORDER_READY', title: 'Pesanan siap diambil', subtitle: null, receipt: 'J+2026UJI', datetime: '20 Oct 2026 | 10:00',
      pickupTime: '20 Oct 2026 | 10:05', pickupCode: 'A12', outletName: 'TALANG JAWA', outletAddress: 'Muara Enim',
      qr: { size: 21, d: 'M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0z' },
      items: [{ qty: 1, name: 'Signature Kopi Susu', info: 'Ice Temp, Large Size', notes: 'Ice: Less', image: null }],
    }),
  };
  await page.route(/\/rest\/v1\/checkout_jobs\?/, (route) => {
    const id = new URL(route.request().url()).searchParams.get('id')!.replace(/^eq\./, '');
    return route.fulfill({ json: jobs[id] });
  });

  for (const [id, berkas, teks] of [
    ['uji-tomoro', 'Struk_Tomoro_UJI-tomoro.png', 'Order Number'],
    ['uji-janjijiwa', 'Struk_JanjiJiwa_UJI-janjijiwa.png', 'Kode Pick Up Kamu'],
  ]) {
    await page.goto(`/checkout-process/${id}`);
    await expect(page.getByText(teks)).toBeVisible();
    await expect(page.getByText('Atas nama:')).toContainText('Budi');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download PNG' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(berkas);
    const png = await readFile(await download.path());
    expect(png.readUInt32BE(16)).toBe(800); // lebar ekspor 400 px x pixelRatio 2
  }
  await expect(page.getByRole('img', { name: 'QR kode pick up' })).toBeVisible(); // QR hanya di struk JJ
});

test.describe('sebagai staff', () => {
  // Peran dibaca dari sesi lokal (AuthContext: getSession, bukan getUser), jadi cukup ubah
  // user_metadata.role di localStorage. Token di server tetap milik akun tes super admin.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      for (const key of Object.keys(localStorage)) {
        if (!/^sb-.+-auth-token$/.test(key)) continue;
        const session = JSON.parse(localStorage.getItem(key)!);
        session.user.user_metadata = { ...session.user.user_metadata, role: 'staff' };
        localStorage.setItem(key, JSON.stringify(session));
      }
    });
  });

  test('bar bawah: Lainnya berisi Watermark dan Keluar', async ({ page }) => {
    await page.goto('/inventory');
    const bar = page.locator('nav.fixed.bottom-0');
    await bar.getByRole('button', { name: 'Lainnya' }).click();
    await expect(bar.getByRole('button', { name: 'Keluar' })).toBeVisible(); // jangan diklik: logout = request tulis
    await expect(bar.getByRole('button', { name: /Finance/ })).toHaveCount(0); // menu super admin tetap tersembunyi
    await bar.getByRole('button', { name: /Watermark/ }).click();
    await expect(page).toHaveURL(/\/watermark$/);
  });
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
