import type { BrowserContext } from '@playwright/test';

// Tes admin WAJIB read-only: data di sini data produksi (pesanan, akun, keuangan).
// Request yang boleh menulis hanya login/refresh token dan RPC baca. Sisanya digagalkan dan dicatat
// supaya tes merah (jangan sampai klik/efek halaman diam-diam mengubah data).
const READ_RPC = /\/rest\/v1\/rpc\/(get_[a-z0-9_]+|finance_search_transactions)$/;

export async function readOnlyGuard(ctx: BrowserContext): Promise<string[]> {
  const blocked: string[] = [];
  await ctx.route(/.*/, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return route.fallback();
    if (url.pathname === '/auth/v1/token') return route.fallback();
    if (method === 'POST' && READ_RPC.test(url.pathname)) return route.fallback();
    blocked.push(`${method} ${url.host}${url.pathname}`);
    return route.abort();
  });
  // Realtime: pesanan/akun baru yang masuk saat tes bikin screenshot berubah; koneksinya dibiarkan bisu.
  await ctx.routeWebSocket(/\/realtime\/v1\//, () => {});
  return blocked;
}
