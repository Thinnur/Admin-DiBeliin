// Alat ukur refactor performa admin: ukuran JS/CSS yang dimuat awal + median Lighthouse mobile SETELAH login.
//   [PAGES=/outlets,/menus] node scripts/ukur-perf.mjs [baseURL] [jumlahRun]
//   baseURL default http://127.0.0.1:4174 (jalankan dulu: npx vite build --outDir node_modules/.cache/e2e-dist
//     && npx vite preview --outDir node_modules/.cache/e2e-dist --port 4174). Produksi: https://fp.akzara.id
// Sesi login diambil dari e2e/.auth/admin.json (hasil `npm run test:smoke`); localStorage-nya disalin ke origin
// baseURL, lalu Lighthouse menumpang di Chromium yang sama (--port, --disable-storage-reset).
// Hanya memuat halaman, tanpa klik. Pastikan smoke test (pengaman tulis) hijau dulu: kalau halaman menulis
// saat dimuat, Lighthouse tidak punya pengaman itu.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4174';
const RUNS = Number(process.argv[3] ?? 3);
const PAGES = process.env.PAGES?.split(',') ?? ['/inventory', '/calculator', '/checkout-history', '/finance'];
const OUT = 'node_modules/.cache/e2e-dist';
const PORT = 9333;
const VPS_CHROMIUM = `${homedir()}/.cache/ms-playwright/chromium-1247/chrome-linux64/chrome`;
const executablePath = process.env.PW_CHROMIUM ?? (existsSync(VPS_CHROMIUM) ? VPS_CHROMIUM : undefined);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// 1. Aset yang dimuat index.html (entry + modulepreload + css) dari build lokal.
if (existsSync(`${OUT}/index.html`)) {
  const html = readFileSync(`${OUT}/index.html`, 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  let raw = 0, gz = 0;
  console.log(`## Aset awal (${OUT}/index.html)\n\n| file | mentah | gzip |\n|---|---|---|`);
  for (const a of assets) {
    const buf = readFileSync(`${OUT}${a}`);
    const g = gzipSync(buf).length;
    raw += buf.length; gz += g;
    console.log(`| ${a.replace('/assets/', '')} | ${kb(buf.length)} | ${kb(g)} |`);
  }
  console.log(`| **total** | **${kb(raw)}** | **${kb(gz)}** |\n`);
}

// 2. Chromium persisten berisi sesi login, Lighthouse menumpang lewat port debug.
const state = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf8'));
const storage = state.origins.flatMap((o) => o.localStorage);
const profile = mkdtempSync(join(tmpdir(), 'lh-admin-'));
// Chromium dijalankan sendiri (bukan launchPersistentContext): kalau Playwright yang mengelola browser,
// tab buatan Lighthouse ikut ditutup ("Target closed").
const chrome = spawn(executablePath ?? chromium.executablePath(), [`--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, '--headless=new', '--no-sandbox', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
try {
  const connect = async () => {
    for (let i = 0; ; i++) {
      try { return await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); } catch (e) { if (i >= 40) throw e; }
      await new Promise((r) => setTimeout(r, 250)); // Chromium belum siap
    }
  };
  const cdp = await connect();
  const page = await cdp.contexts()[0].newPage();
  await page.goto(`${BASE}/login`);
  await page.evaluate((items) => items.forEach(({ name, value }) => localStorage.setItem(name, value)), storage);
  await page.goto(`${BASE}/inventory`, { waitUntil: 'networkidle' });
  if (page.url().includes('/login')) throw new Error('Sesi login tak berlaku: jalankan npm run test:smoke dulu');
  await page.close();
  await cdp.close(); // lepas tanpa menutup Chromium

  // --disable-storage-reset ikut menyimpan cache HTTP; kosongkan tiap run supaya JS diukur dingin (localStorage tetap).
  const clearCache = async () => {
    const b = await connect();
    const tab = await b.contexts()[0].newPage();
    await (await b.contexts()[0].newCDPSession(tab)).send('Network.clearBrowserCache');
    await tab.close();
    await b.close();
  };

  console.log(`## Lighthouse mobile (sudah login) — ${BASE} (median ${RUNS} run)\n`);
  console.log('| halaman | skor | FCP | LCP | TBT | CLS | SI | JS dimuat |\n|---|---|---|---|---|---|---|---|');
  for (const p of PAGES) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      await clearCache();
      const out = execFileSync('npx', ['-y', 'lighthouse@13.5.0', BASE + p, '--only-categories=performance',
        `--port=${PORT}`, '--disable-storage-reset', '--output=json', '--output-path=stdout', '--quiet'],
        { maxBuffer: 64 << 20 });
      const r = JSON.parse(out);
      if (r.finalDisplayedUrl.includes('/login')) throw new Error(`${p}: terlempar ke /login`);
      const a = r.audits;
      const js = a['network-requests'].details.items
        .filter((x) => x.resourceType === 'Script').reduce((s, x) => s + (x.transferSize ?? 0), 0);
      runs.push({ score: r.categories.performance.score * 100, fcp: a['first-contentful-paint'].numericValue,
        lcp: a['largest-contentful-paint'].numericValue, tbt: a['total-blocking-time'].numericValue,
        cls: a['cumulative-layout-shift'].numericValue, si: a['speed-index'].numericValue, js });
    }
    const m = (k) => median(runs.map((r) => r[k]));
    const s = (ms) => `${(ms / 1000).toFixed(2)} s`;
    console.log(`| ${p} | ${m('score').toFixed(0)} | ${s(m('fcp'))} | ${s(m('lcp'))} | ${m('tbt').toFixed(0)} ms | ${m('cls').toFixed(3)} | ${s(m('si'))} | ${kb(m('js'))} |`);
  }
} finally {
  chrome.kill();
  await new Promise((r) => chrome.once('exit', r));
  rmSync(profile, { recursive: true, force: true });
}
