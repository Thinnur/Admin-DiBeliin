import { test as setup, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { readOnlyGuard } from './guard';

// Login sekali per run, sesinya dipakai semua tes. Kredensial super admin TIDAK di repo:
// ~/.config/dibeliin/admin-e2e.env berisi E2E_EMAIL=... dan E2E_PASSWORD=... (dibaca apa adanya, tanpa shell).
export const AUTH_STATE = 'e2e/.auth/admin.json';
const CRED_FILE = `${homedir()}/.config/dibeliin/admin-e2e.env`;

function credentials() {
  if (!existsSync(CRED_FILE)) throw new Error(`Kredensial tes belum ada: buat ${CRED_FILE} (lihat CLAUDE.md)`);
  const env = Object.fromEntries(
    readFileSync(CRED_FILE, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1)];
    }),
  );
  if (!env.E2E_EMAIL || !env.E2E_PASSWORD) throw new Error(`${CRED_FILE} wajib berisi E2E_EMAIL dan E2E_PASSWORD`);
  return { email: env.E2E_EMAIL, password: env.E2E_PASSWORD };
}

setup('login super admin', async ({ page }) => {
  const blocked = await readOnlyGuard(page.context());
  const { email, password } = credentials();
  await page.goto('/login');
  await page.getByPlaceholder('admin@dibeliin.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/inventory/, { timeout: 30_000 });
  await page.context().storageState({ path: AUTH_STATE });
  expect(blocked, 'request tulis yang dicegah').toEqual([]);
});
