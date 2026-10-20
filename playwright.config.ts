import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';

// VPS: Chromium yang sudah terpasang (chromium-1234 milik worker pm2 jangan disentuh). Laptop: bawaan Playwright.
const VPS_CHROMIUM = `${homedir()}/.cache/ms-playwright/chromium-1247/chrome-linux64/chrome`;
const executablePath = process.env.PW_CHROMIUM ?? (existsSync(VPS_CHROMIUM) ? VPS_CHROMIUM : undefined);
// dist/ dilacak git di repo ini: build tes ditaruh di luar supaya dist/index.html tak ikut berubah.
const OUT = 'node_modules/.cache/e2e-dist';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  timeout: 90_000, // halaman admin berat + data produksi
  workers: 1, // VPS produksi RAM-nya pas-pasan; 2 worker + halaman admin raksasa sempat menyisakan <300 MB
  reporter: [['list']],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    serviceWorkers: 'block', // jangan sampai daftar Web Push dari tes
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], storageState: 'e2e/.auth/admin.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: `npx vite build --outDir ${OUT} --emptyOutDir && npx vite preview --outDir ${OUT} --host 127.0.0.1 --port 4174 --strictPort`,
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
