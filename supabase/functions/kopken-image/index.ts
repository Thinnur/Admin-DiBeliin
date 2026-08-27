// =============================================================================
// kopken-image — proxy gambar produk Kopken/Fore supaya bisa diekspor jadi PNG
// =============================================================================
// cdn.kopikenangan.com tidak mengirim Access-Control-Allow-Origin (dicek
// 2026-08-27). Menampilkan <img> dari sana tetap bisa, tapi html-to-image
// harus MEM-FETCH tiap gambar untuk di-inline jadi data URI sebelum menggambar
// ke canvas — dan fetch itulah yang diblokir CORS. Tanpa proxy, struk Kopken
// yang digambar sendiri di admin akan terekspor tanpa satu pun foto produk.
// kopsu.app memakai proxy sendiri (/api/kopken/image?url=) karena hal yang sama.
//
// verify_jwt sengaja dimatikan: atribut src pada <img> tidak bisa membawa
// header Authorization. Sebagai gantinya akses dibatasi daftar host di bawah —
// fungsi ini HANYA meneruskan gambar dari CDN menu Kopken/Fore, jadi bukan
// proxy terbuka yang bisa dipakai menembak host internal (SSRF).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

/** Hanya CDN gambar menu. Jangan tambah host tanpa alasan — tiap tambahan
 *  memperluas apa yang bisa dijangkau lewat endpoint publik ini. */
const HOST_DIIZINKAN = new Set([
    'cdn.kopikenangan.com',
    'static.fore.coffee',
]);

/**
 * cdn.kopikenangan.com berjalan di atas Aliyun OSS dan menerima parameter
 * `x-oss-process`. Ini bukan penghematan kecil: foto menu aslinya ~2,7 MB
 * (diukur 2026-08-27), padahal di struk cuma digambar 64x64. Dengan
 * resize w_192 ukurannya jadi ~19 KB — 145x lebih kecil. Tanpa ini, ekspor
 * PNG struk berisi 5 item harus menarik belasan megabyte dulu.
 */
const LEBAR_BAWAAN = 192;
const HOST_OSS = 'cdn.kopikenangan.com';

/** Setelah diperkecil harusnya puluhan KB; 5 MB adalah pagar, bukan target. */
const MAKS_BYTE = 5 * 1024 * 1024;

const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'GET, OPTIONS',
};

const tolak = (pesan: string, status: number) =>
    new Response(pesan, { status, headers: { ...CORS, 'content-type': 'text/plain' } });

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'GET') return tolak('Method not allowed', 405);

    const param = new URL(req.url).searchParams;
    const target = param.get('url');
    if (!target) return tolak('Parameter "url" wajib diisi', 400);
    const lebar = Math.min(Math.max(Number(param.get('w')) || LEBAR_BAWAAN, 32), 1024);

    let tujuan: URL;
    try {
        tujuan = new URL(target);
    } catch {
        return tolak('URL tidak valid', 400);
    }
    if (tujuan.protocol !== 'https:') return tolak('Hanya https yang diizinkan', 400);
    if (!HOST_DIIZINKAN.has(tujuan.hostname)) return tolak(`Host tidak diizinkan: ${tujuan.hostname}`, 403);

    if (tujuan.hostname === HOST_OSS && !tujuan.searchParams.has('x-oss-process')) {
        tujuan.searchParams.set('x-oss-process', `image/resize,w_${lebar}`);
    }

    let hulu: Response;
    try {
        hulu = await fetch(tujuan.toString(), { redirect: 'follow' });
    } catch (e) {
        return tolak(`Gagal mengambil gambar: ${e instanceof Error ? e.message : e}`, 502);
    }
    if (!hulu.ok) return tolak(`CDN membalas ${hulu.status}`, 502);

    // Pastikan yang diteruskan memang gambar — kalau host di daftar tiba-tiba
    // melayani HTML/JSON, jangan ikut menyebarkannya lewat origin kita.
    const tipe = hulu.headers.get('content-type') ?? '';
    if (!tipe.startsWith('image/')) return tolak(`Bukan gambar (${tipe})`, 415);

    const panjang = Number(hulu.headers.get('content-length') ?? 0);
    if (panjang > MAKS_BYTE) return tolak('Gambar terlalu besar', 413);

    const isi = await hulu.arrayBuffer();
    if (isi.byteLength > MAKS_BYTE) return tolak('Gambar terlalu besar', 413);

    return new Response(isi, {
        headers: {
            ...CORS,
            'content-type': tipe,
            // Gambar menu praktis tidak pernah berubah untuk URL yang sama.
            'cache-control': 'public, max-age=604800, immutable',
        },
    });
});
