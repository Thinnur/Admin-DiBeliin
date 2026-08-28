// =============================================================================
// DiBeliin Admin - Layar "Pickup" Kopi Kenangan
// =============================================================================
// Replika layar pickup Kopken yang digambar sendiri di admin, menggantikan
// screenshot Playwright dari halaman /kopken/receipt/... di kopsu.app.
//
// SUMBER TATA LETAK
// Aplikasi Kopken (com.kopikenangan v126.08.13) adalah aplikasi FLUTTER —
// seluruh UI-nya ada di libapp.so sebagai kode Dart yang sudah di-AOT, dan
// paket com.kopikenangan cuma punya 5 kelas Java (Application, MainActivity,
// R, SharePlusPendingIntent, FCM service). Artinya JADX TIDAK bisa dipakai
// buat membaca layar ini, beda dengan Fore yang native Compose.
//
// Jadi acuan pikselnya diambil dari bundel SvelteKit kopsu.app —
// `_app/immutable/nodes/34.hC1lcHpm.js`, chunk halaman receipt — yang
// menyimpan seluruh markup + kelas Tailwind-nya sebagai template literal.
// Nilai yang diambil apa adanya dari sana: pita atas #eefaf5, lingkaran
// tahapan 52px (#CD9554 aktif / border #DEB98A pasif), garis penghubung
// border-t-[3px] solid saat terlewati dan dashed saat belum, bar progres
// #5fc3ba 5px dengan lebar 33/66/100, dan nomor order text-6xl font-black.
// Ikonnya juga aset kopsu yang sama, disalin ke public/kopken-assets/.
//
// LEBAR 400px mengikuti lebar ekspor kopsu (`t.style.width='400px'` sebelum
// snapdom.toPng scale 2), supaya gambar yang dikirim ke pelanggan tidak
// berubah proporsi dari yang selama ini mereka terima.
//
// Semua blok hiasan kopsu ikut disalin apa adanya — bar status iOS, kartu
// "Promo Spesial Buat Member!", kartu "Isi Profil Kamu Yuk!", banner promo,
// dan tombol "Lihat Semua ˅" — supaya gambar yang diterima pelanggan sama
// persis dengan yang selama ini dikirim. Semuanya dirender sebagai <div>,
// bukan <button>/<a>: isinya cuma perlu ikut tergambar di PNG, dan di kopsu
// pun tidak satu pun dari tombol itu punya onclick.

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Copy, Wifi } from 'lucide-react';

import { useEksporGambar, TombolEkspor } from './useEksporGambar';

/** Versi bentuk data — dinaikkan kalau mapper di worker berubah, biar worker
 *  menulis ulang struk lama yang bentuknya sudah basi. */
export const KOPKEN_RECEIPT_VERSION = 1;

export interface KopkenReceiptItem {
    image?: string | null;
    title: string;
    subtitle?: string | null;
    price?: number | null;
    /** Harga sebelum diskon. Kalau > 0 inilah yang ditampilkan (ikut kopsu). */
    origPrice?: number | null;
    quantity?: number | null;
}

export interface KopkenReceiptData {
    v?: number;
    /** 'checkout' = struk awal yang disusun worker sesaat setelah order dibuat
     *  (belum ada nomor antrean); 'd5rk' = sudah dikonfirmasi Kopken. */
    sumber?: 'checkout' | 'd5rk';
    queueNumber?: string | null;
    phase?: string | null;
    phases?: string[] | null;
    statusTitle?: string | null;
    statusDesc?: string | null;
    /** Epoch (detik atau milidetik) perkiraan pesanan siap diambil. */
    estimatedDropoffAt?: number | null;
    customerName?: string | null;
    outletName?: string | null;
    transactionId?: string | null;
    /** Tanggal pesanan, sudah diformat worker ("27 Agu 2026, 22:29"). */
    date?: string | null;
    items?: KopkenReceiptItem[] | null;
    totalQty?: number | null;
    grandTotal?: number | null;
    paymentMethod?: string | null;
    paymentLogoUrl?: string | null;
    wifi?: { ssid?: string | null; account?: string | null; password?: string | null } | null;
    /** Banner promo di antara kartu Detail Pesanan dan Pesanan. Kosong =
     *  dipakai gambar bawaan `/kopken-assets/download_1.jpg`, sama seperti kopsu. */
    promoBannerUrl?: string | null;
    /** Rincian harga apa adanya dari d5rk (subtotal, diskon, pajak, total).
     *  Halaman kopsu TIDAK menampilkannya — tombol "Lihat Semua" di sana cuma
     *  hiasan — tapi datanya tetap disimpan supaya bisa dipakai kalau nanti
     *  rinciannya memang mau dimunculkan. */
    priceTable?: { name: string; value: number; wording?: string | null; fontSize?: string | null; color?: string | null }[] | null;
}

/** Lebar ekspor, mengikuti kopsu (`style.width='400px'` sebelum snapdom scale 2,
 *  jadi PNG-nya 800px). Dipaksakan sesaat saat memotret supaya gambar yang
 *  dikirim ke pelanggan berukuran sama, diekspor dari ponsel maupun desktop. */
const LEBAR_EKSPOR = 400;

const A = '/kopken-assets';
const FALLBACK_MENU = `${A}/menu_image.png`;

const rp = (n?: number | null) => `Rp${Math.round(n ?? 0).toLocaleString('id-ID')}`;

/** Harga yang ditampilkan per baris: harga asli kalau ada (ikut kopsu), kalau
 *  tidak harga bayarnya. null = belum diketahui, jangan digambar sama sekali. */
function hargaBaris(it: KopkenReceiptItem): number | null {
    if ((it.origPrice ?? 0) > 0) return it.origPrice!;
    return typeof it.price === 'number' ? it.price : null;
}

/**
 * Gambar produk & logo pembayaran Kopken dilayani cdn.kopikenangan.com yang
 * TIDAK mengirim Access-Control-Allow-Origin (dicek 2026-08-27: header-nya
 * kosong, yang ada cuma timing-allow-origin). html-to-image harus mem-fetch
 * tiap gambar untuk di-inline jadi data URI, jadi tanpa proxy hasil ekspor
 * PNG-nya kehilangan semua foto. kopsu memakai proxy sendiri
 * (`/api/kopken/image?url=`) persis karena alasan yang sama.
 */
export function proxyGambar(url?: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('/') || url.startsWith('data:')) return url;
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!base) return url;
    return `${base}/functions/v1/kopken-image?url=${encodeURIComponent(url)}`;
}

/**
 * Indeks tahapan yang sedang berjalan.
 *
 * Disalin dari kopsu: posisi `phase` di dalam `phases` (setelah dinormalisasi
 * jadi huruf-angka saja) dibandingkan dengan tebakan dari statusTitle, lalu
 * diambil yang paling maju. Dua sumber dipakai karena `phase` sempat
 * tertinggal di "Sedang Diproses" padahal statusTitle sudah "Pesanan Sudah
 * Siap" — kalau cuma pakai salah satu, tahapannya bisa mundur sendiri.
 */
function indeksTahap(data: KopkenReceiptData): number {
    const phases = data.phases ?? [];
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const judul = (data.statusTitle ?? '').toLowerCase();
    const dariJudul = judul.includes('siap') || judul.includes('ambil') ? 1 : judul.includes('selesai') ? 2 : 0;
    const dariPhase = phases.findIndex((p) => norm(p) === norm(data.phase ?? ''));
    return Math.max(dariPhase === -1 ? 0 : dariPhase, dariJudul);
}

const jam = (d: Date) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Kadang Kopken mengisi `statusDesc` bukan dengan kalimat, tapi dengan JAM
 * telanjang ("22.35") saat pesanan sudah siap diambil. kopsu menangani ini:
 * kalau statusTitle menyebut pickup/ambil DAN statusDesc cuma jam, angka itu
 * dibaca sebagai waktu pickup, lalu judul & keterangan diganti teks bawaan —
 * kalau tidak, kartu statusnya cuma menampilkan "22.35" tanpa penjelasan apa pun.
 * Nilai balik = menit sejak tengah malam, atau null kalau bukan kasus ini.
 */
function menitDariStatusDesc(data: KopkenReceiptData): number | null {
    if (!/pickup|ambil/i.test(data.statusTitle ?? '')) return null;
    const cocok = (data.statusDesc ?? '').trim().match(/^(\d{1,2})[.:](\d{2})$/);
    if (!cocok) return null;
    const j = Number(cocok[1]);
    const m = Number(cocok[2]);
    return j > 23 || m > 59 ? null : j * 60 + m;
}

/** "Perkiraan siap pickup 22.35 - 22.45" — jendela 10 menit, ikut kopsu. */
function jendelaPickup(data: KopkenReceiptData, menitPickup: number | null): string | null {
    const epoch = data.estimatedDropoffAt;
    if (epoch) {
        // Kopken kadang mengirim detik, kadang milidetik.
        const ms = epoch < 1e12 ? epoch * 1000 : epoch;
        const mulai = new Date(ms);
        if (!Number.isNaN(mulai.getTime())) return `${jam(mulai)} - ${jam(new Date(ms + 10 * 60_000))}`;
    }
    if (menitPickup === null) return null;
    const d = new Date();
    d.setHours(Math.floor(menitPickup / 60), menitPickup % 60, 0, 0);
    return `${jam(d)} - ${jam(new Date(d.getTime() + 10 * 60_000))}`;
}

/** Bar status ala iOS di atas layar — bagian dari tampilan kopsu yang bikin
 *  hasilnya terbaca sebagai screenshot aplikasi, bukan halaman web. */
function BarStatus() {
    const jamSekarang = () =>
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    const [sekarang, setSekarang] = useState(jamSekarang);

    useEffect(() => {
        const t = setInterval(() => setSekarang(jamSekarang()), 10_000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="flex h-12 w-full items-center justify-between px-6 pb-2 pt-3">
            <div className="w-[70px] pl-1 text-left text-[15px] font-semibold tracking-tight text-slate-800">{sekarang}</div>
            <div className="relative h-[28px] w-[100px] shrink-0 rounded-[20px] bg-black shadow-sm">
                <div className="absolute right-3 top-1/2 h-[10px] w-[10px] -translate-y-1/2 overflow-hidden rounded-full border border-white/10 bg-[#1a1a1a] shadow-inner">
                    <div className="absolute right-[2px] top-[2px] h-[3px] w-[3px] rounded-full bg-[#344073] opacity-60" />
                </div>
            </div>
            <div className="flex items-center justify-end gap-[5px] pr-1 text-slate-800">
                <div className="flex h-[10.5px] items-end gap-[1.5px] pb-[0.5px]">
                    {[4, 6, 8, 10].map((h) => (
                        <div key={h} className="w-[2.5px] rounded-[0.5px] bg-black" style={{ height: `${h}px` }} />
                    ))}
                </div>
                <svg width="18" height="14" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M256 96c-81.5 0-163 33.6-221.5 88.3-3.3 3-3.4 8.1-.3 11.4l26.7 27.9c3.1 3.3 8.3 3.4 11.6.3 23.3-21.6 49.9-38.8 79.3-51 33-13.8 68.1-20.7 104.3-20.7s71.3 7 104.3 20.7c29.4 12.3 56 29.4 79.3 51 3.3 3.1 8.5 3 11.6-.3l26.7-27.9c3.1-3.2 3-8.3-.3-11.4C419 129.6 337.5 96 256 96z"
                        fill="#000"
                    />
                    <path
                        d="M113.2 277.5l28.6 28.3c3.1 3 8 3.2 11.2.3 28.3-25.1 64.6-38.9 102.9-38.9s74.6 13.7 102.9 38.9c3.2 2.9 8.1 2.7 11.2-.3l28.6-28.3c3.3-3.3 3.2-8.6-.3-11.7-37.5-33.9-87.6-54.6-142.5-54.6s-105 20.7-142.5 54.6c-3.3 3.1-3.4 8.4-.1 11.7z"
                        fill="#000"
                    />
                    <path
                        d="M256 324.2c-23.4 0-44.6 9.8-59.4 25.5-3 3.2-2.9 8.1.2 11.2l53.4 52.7c3.2 3.2 8.4 3.2 11.6 0l53.4-52.7c3.1-3.1 3.2-8 .2-11.2-14.8-15.6-36-25.5-59.4-25.5z"
                        fill="#000"
                    />
                </svg>
                <div className="relative flex items-center">
                    <div className="relative flex h-[12px] w-[24px] items-center justify-start overflow-hidden rounded-[3.5px] border border-black/40 p-px">
                        <div className="h-[8px] rounded-[1.5px] bg-black" style={{ width: '82%' }} />
                    </div>
                    <div className="ml-[0.5px] h-[4px] w-[1.5px] rounded-r-[1px] bg-black/40" />
                </div>
            </div>
        </div>
    );
}

const IKON_TAHAP = [
    { src: `${A}/icon_transfer.svg`, alt: 'Process', size: 'h-8 w-8', pasif: 'opacity-50 grayscale' },
    { src: `${A}/icon_outlet.svg`, alt: 'Pickup', size: 'h-7 w-7', pasif: 'opacity-40 grayscale' },
    { src: `${A}/icon_state_yes.svg`, alt: 'Done', size: 'h-7 w-7', pasif: 'opacity-40 grayscale' },
];

function Tahapan({ phases, aktif }: { phases: string[]; aktif: number }) {
    return (
        <div className="mx-auto flex max-w-sm items-center justify-center px-6">
            {phases.map((label, i) => {
                const terlewati = i <= aktif;
                const ikon = IKON_TAHAP[Math.min(i, IKON_TAHAP.length - 1)];
                const [baris1, ...sisa] = label.split(' ');
                return (
                    <div key={label} className="flex flex-1 flex-col items-center">
                        <div className="relative flex w-full flex-col items-center justify-center">
                            {i !== phases.length - 1 && (
                                <div
                                    className={`absolute -right-1/2 top-1/2 z-0 w-full -translate-y-1/2 border-t-[3px] ${
                                        terlewati && i < aktif
                                            ? 'border-solid border-[#CD9554]'
                                            : 'border-dashed border-[#DEB98A]'
                                    }`}
                                />
                            )}
                            <div
                                className={`relative z-10 grid h-[52px] w-[52px] place-items-center rounded-full ${
                                    terlewati ? 'bg-[#CD9554]' : 'border-[3px] border-[#DEB98A] bg-white'
                                }`}
                            >
                                <img
                                    src={ikon.src}
                                    alt={ikon.alt}
                                    className={`${ikon.size} ${terlewati ? 'brightness-0 invert' : ikon.pasif}`}
                                />
                            </div>
                        </div>
                        <div
                            className={`mt-2 whitespace-nowrap text-center text-[12px] ${
                                i === aktif ? 'font-black text-slate-800' : 'font-medium text-slate-400'
                            }`}
                        >
                            <div className="flex flex-col">
                                <span>{baris1}</span>
                                <span>{sisa.join(' ')}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Kartu ajakan gabung member + tombol WhatsApp.
 *
 * Ini hiasan milik kopsu, bukan bagian dari pesanan, dan tombolnya di sana pun
 * tidak menuju ke mana-mana. Dirender sebagai <div>, BUKAN <button>: isinya
 * cuma perlu ikut tergambar di PNG, dan tombol hidup di panel admin cuma bikin
 * orang salah pencet.
 */
function KartuPromoMember() {
    return (
        <div className="overflow-hidden rounded-xl bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <div className="flex items-start justify-between gap-2">
                <div className="mt-1 flex-1">
                    <div className="flex items-center gap-1 text-[14px] font-bold leading-tight text-[#009B70]">
                        <span className="text-yellow-400">✨</span> Promo Spesial Buat Member!
                    </div>
                    <div className="mt-2 pr-2 text-[10.5px] leading-snug text-slate-500">
                        Gabung sekarang dan jangan lewatkan penawaran menarik setiap saat.
                    </div>
                </div>
                <div className="-mt-2 w-[120px] shrink-0">
                    <img
                        src={`${A}/voucher-10rb.png`}
                        alt="Voucher Diskon 10RB"
                        className="h-auto w-full object-contain mix-blend-multiply"
                    />
                </div>
            </div>
            <div className="mt-3 flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#25D366] py-2.5 text-[13px] font-bold text-white shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>{' '}
                Gabung Sekarang
            </div>
        </div>
    );
}

/** Kartu "Isi Profil Kamu Yuk!" dengan cincin progres 20%. Angka 20% di kopsu
 *  memang tetap (stroke-dasharray "20, 100"), bukan progres profil sungguhan. */
function KartuIsiProfil() {
    return (
        <div className="flex items-center justify-between rounded-xl bg-white px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-4">
                <div className="relative h-12 w-12">
                    {/* Warnanya ditulis langsung di atribut `stroke`, BUKAN lewat
                        `stroke="currentColor"` + kelas Tailwind seperti di kopsu.
                        html-to-image menyalin computed style ke elemen <svg> induk
                        tapi TIDAK ke anak-anaknya, jadi `currentColor` di dalam
                        <path> jatuh ke warna teks yang diwarisi — cincinnya terekspor
                        jadi slate-800 pekat (diukur: rgb(29,41,61)) padahal di layar
                        abu-abu + oranye. Aturan yang sama berlaku buat SVG mana pun
                        di berkas ini: warna anak <svg> harus atribut, bukan CSS. */}
                    <svg className="h-full w-full transform" viewBox="0 0 36 36">
                        <path
                            strokeWidth="3.5"
                            stroke="#e2e8f0"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                            strokeDasharray="20, 100"
                            strokeWidth="3.5"
                            stroke="#c98751"
                            fill="none"
                            strokeLinecap="round"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[13px] font-bold text-[#c98751]">20%</span>
                    </div>
                </div>
                <div>
                    <div className="text-[14px] font-bold text-slate-800">Isi Profil Kamu Yuk!</div>
                    <div className="text-[11px] text-slate-500">Biar hubungan kita makin dekat</div>
                </div>
            </div>
            <div className="rounded-md bg-[#C82A2A] px-[18px] py-[8px] text-[13px] font-bold tracking-wide text-white shadow-sm">
                Lengkapi
            </div>
        </div>
    );
}

/** Banner promo. Tanpa `promoBannerUrl` kopsu memasang gambar bawaannya
 *  sendiri, jadi kartunya tidak pernah kosong. */
function KartuBannerPromo({ url }: { url?: string | null }) {
    const src = proxyGambar(url) ?? `${A}/download_1.jpg`;
    return (
        <div className="overflow-hidden rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <img
                src={src}
                alt="Promo"
                crossOrigin="anonymous"
                className="h-auto w-full object-cover"
                onError={(e) => {
                    const el = e.currentTarget;
                    if (!el.src.endsWith('download_1.jpg')) el.src = `${A}/download_1.jpg`;
                }}
            />
        </div>
    );
}

function JudulKartu({
    ikon,
    kelasIkon,
    teks,
    kanan,
}: {
    ikon: string;
    kelasIkon: string;
    teks: string;
    kanan?: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-slate-800">
                <img src={ikon} alt={teks} className={`${kelasIkon} object-contain`} />
                {teks}
            </div>
            {kanan}
        </div>
    );
}

export function KopkenPickupScreen({ data }: { data: KopkenReceiptData }) {
    const phases = data.phases?.length ? data.phases : ['Sedang Diproses', 'Ambil Sekarang', 'Sudah diambil'];
    const aktif = indeksTahap(data);
    const lebarProgres = aktif === 0 ? 33 : aktif === 1 ? 66 : 100;
    const menitPickup = menitDariStatusDesc(data);
    const jendela = jendelaPickup(data, menitPickup);
    // Kalau statusDesc ternyata cuma jam, ia sudah "dipakai" jadi jendela
    // pickup di atas — judul & keterangan kartu status balik ke teks bawaan.
    const judul = (menitPickup === null && data.statusTitle) || 'Pesanan Diterima';
    const keterangan =
        (menitPickup === null && data.statusDesc) ||
        'Mohon tunggu sebentar untuk memberi waktu ke staff kami dalam menyiapkan pesanan kamu yah';
    const items = data.items ?? [];
    const wifi = data.wifi;

    return (
        // Lebarnya lentur (dibatasi 400px oleh pembungkus di KopkenPickupCard)
        // supaya muat di layar ponsel — di 375px versi w-[400px] bikin seluruh
        // halaman meluber 49px. Lebar 400px tetap dipakai saat ekspor, lihat
        // `lebarEkspor` di useEksporGambar.
        <div className="w-full bg-slate-50 pb-8 font-sans text-slate-800">
            <div style={{ backgroundColor: '#eefaf5' }}>
                <BarStatus />
                <header className="flex h-14 items-center px-4">
                    <div className="mr-3 rounded-full p-2">
                        <ChevronLeft className="h-5 w-5 text-slate-800" />
                    </div>
                    <div className="flex-1 text-center text-lg font-bold">Pickup</div>
                    <div className="w-10" />
                </header>
                <div className="pb-8 pt-4">
                    {jendela && (
                        <div className="flex justify-center px-6 pb-5">
                            <div className="rounded-full bg-white px-5 py-2.5 text-[13px] shadow-sm">
                                <span className="text-slate-500">Perkiraan siap pickup</span>
                                <span className="ml-1 font-bold text-slate-800">{jendela}</span>
                            </div>
                        </div>
                    )}
                    <Tahapan phases={phases} aktif={aktif} />
                    <div className="mt-8 pb-2 text-center">
                        <div className="text-[13px] font-bold text-slate-800">Nomor Order</div>
                        <div className="mt-1 text-6xl font-black tracking-tight text-slate-800">
                            {data.queueNumber || '-'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-4 pb-12">
                <div className="relative -mt-6 mx-auto max-w-md overflow-hidden rounded-xl bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
                    <div className="text-center text-[15px] font-bold text-slate-800">{judul}</div>
                    <div className="mx-auto mt-2 max-w-[280px] text-center text-[11px] font-medium leading-relaxed text-slate-500">
                        {keterangan}
                    </div>
                    <div className="absolute bottom-0 left-0 h-[5px] bg-[#5fc3ba]" style={{ width: `${lebarProgres}%` }} />
                </div>

                <div className="mx-auto max-w-md space-y-3 pt-6">
                    {wifi?.account && (
                        <div className="relative flex items-center rounded-xl bg-white px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                            <div className="flex flex-1 items-center gap-3 pr-4">
                                <Wifi className="h-5 w-5 text-slate-800" />
                                <div>
                                    <div className="text-[10px] font-medium text-slate-400">SSID: {wifi.ssid || '-'}</div>
                                    <div className="text-[13px] font-bold tracking-tight text-slate-800">{wifi.account}</div>
                                </div>
                            </div>
                            <div className="-my-1 w-[1.5px] self-stretch bg-slate-200" />
                            <div className="flex flex-1 items-center justify-end gap-1.5 pl-4">
                                <div className="text-right">
                                    <div className="text-[10px] font-medium text-slate-400">Password</div>
                                    <div className="text-[13px] font-bold tracking-tight text-slate-800">
                                        {wifi.password || '-'}
                                    </div>
                                </div>
                                <div className="rounded-lg p-1 text-[#2e74c9]">
                                    <Copy className="h-4 w-4" />
                                </div>
                            </div>
                        </div>
                    )}

                    <KartuPromoMember />
                    <KartuIsiProfil />

                    <div className="overflow-hidden rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                        <JudulKartu
                            ikon={`${A}/icon_pay_header.svg`}
                            kelasIkon="h-6 w-6"
                            teks="Detail Pesanan"
                            kanan={<div className="text-[12px] font-medium text-slate-500">{data.date || ''}</div>}
                        />
                        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 pb-4 pt-3">
                            <div className="flex items-center gap-3">
                                <img src={`${A}/icon_user.svg`} alt="User" className="h-5 w-5 opacity-60" />
                                <div>
                                    <div className="text-[10px] font-medium text-slate-400">Nama Pelanggan</div>
                                    <div className="text-[13px] font-bold tracking-tight text-slate-800">
                                        {data.customerName || '-'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <img src={`${A}/kenangan_outlet.png`} alt="Outlet" className="mt-1 h-6 w-6 object-contain" />
                                <div>
                                    <div className="text-[10px] font-medium text-slate-400">Pickup di</div>
                                    <div className="pr-4 text-[13px] font-bold leading-snug tracking-tight text-slate-800">
                                        {data.outletName || '-'}
                                    </div>
                                    <div className="mt-0.5 text-[11px] font-medium text-slate-400">Pickup di Counter</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <KartuBannerPromo url={data.promoBannerUrl} />

                    <div className="overflow-hidden rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                        <JudulKartu
                            ikon={`${A}/cart.png`}
                            kelasIkon="h-10 w-10"
                            teks="Pesanan"
                            kanan={
                                <div className="text-[12px] font-bold text-slate-600">
                                    Total {data.totalQty ?? items.reduce((n, it) => n + (it.quantity ?? 0), 0)}
                                </div>
                            }
                        />
                        <div className="flex flex-col">
                            {items.map((it, i) => (
                                <div
                                    key={`${it.title}-${i}`}
                                    className={`px-5 py-4 ${i === items.length - 1 ? '' : 'border-b border-slate-100'}`}
                                >
                                    <div className="flex gap-4">
                                        <img
                                            src={proxyGambar(it.image) ?? FALLBACK_MENU}
                                            alt={it.title}
                                            className="h-16 w-16 rounded-xl object-contain mix-blend-multiply"
                                            onError={(e) => {
                                                const el = e.currentTarget;
                                                if (el.src.endsWith(FALLBACK_MENU)) return;
                                                // Tanpa baris ini, foto gagal muat dan produk yang
                                                // Kopken memang tidak punya fotonya terlihat sama
                                                // persis — dua-duanya jadi menu_image.png. Kalau
                                                // proxy/CDN-nya bermasalah, jejaknya harus ada.
                                                console.warn('[KopkenPickupScreen] foto produk gagal dimuat:', el.src);
                                                el.src = FALLBACK_MENU;
                                            }}
                                        />
                                        <div className="flex-1">
                                            <div className="text-[13px] font-bold tracking-tight text-slate-800">{it.title}</div>
                                            {it.subtitle && (
                                                <div className="mt-1 text-[11.5px] font-medium leading-snug text-slate-500">
                                                    {it.subtitle}
                                                </div>
                                            )}
                                            <div className="mt-3 flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    {/* Struk awal (sebelum polling d5rk berhasil) bisa belum tahu
                                                        harga per baris. Kosongkan saja — "Rp0" di struk yang
                                                        dikirim ke pelanggan jauh lebih menyesatkan. */}
                                                    {hargaBaris(it) !== null && (
                                                        <div className="text-[13px] font-bold text-slate-800">{rp(hargaBaris(it))}</div>
                                                    )}
                                                </div>
                                                <div className="text-[13px] font-bold text-slate-800">{it.quantity ?? 1}x</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 text-[15px] font-bold tracking-tight text-slate-800">
                            <img src={`${A}/koin_cina.png`} alt="Payment" className="h-8 w-8 object-contain" />
                            Detail Pembayaran
                        </div>
                        <div className="border-b border-slate-100 px-5 py-3">
                            <div className="flex items-start justify-between">
                                <div className="flex flex-col gap-1">
                                    <div className="text-[10px] font-medium text-slate-400">Transaksi ID</div>
                                    <div className="text-[12px] font-bold text-slate-800">{data.transactionId || '-'}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-medium text-slate-400">Total</div>
                                    <div className="text-[14px] font-black text-slate-800">{rp(data.grandTotal)}</div>
                                </div>
                            </div>
                            {data.paymentMethod && (
                                <div className="mt-3 flex items-center gap-2">
                                    {proxyGambar(data.paymentLogoUrl) && (
                                        <img
                                            src={proxyGambar(data.paymentLogoUrl)!}
                                            alt={data.paymentMethod}
                                            className="h-6 w-auto object-contain"
                                        />
                                    )}
                                    <div className="text-[13px] font-bold text-slate-800">{data.paymentMethod}</div>
                                </div>
                            )}
                        </div>
                        {/* Di kopsu tombol ini tidak punya onclick sama sekali — murni meniru
                            tampilan aplikasi. Dibiarkan <div> supaya tidak bisa dipencet. */}
                        <div className="w-full py-3 text-center text-[12px] font-bold" style={{ color: '#2e74c9' }}>
                            Lihat Semua ˅
                        </div>
                    </div>

                    <div className="pt-2 text-center text-[11px] font-medium text-slate-400">All Price are inclusive Tax</div>
                </div>
            </div>
        </div>
    );
}

/** Layar pickup + tombol Salin/Download, sejajar dengan ForePickupCard. */
export function KopkenPickupCard({ data, fileName }: { data: KopkenReceiptData; fileName?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const { sibuk, salin, unduh } = useEksporGambar(
        ref,
        `Struk_${fileName ?? data.transactionId ?? 'kopken'}.png`,
        'Struk',
        LEBAR_EKSPOR,
    );

    return (
        <div className="space-y-3">
            <div ref={ref} className="mx-auto w-full max-w-[400px]">
                <KopkenPickupScreen data={data} />
            </div>
            <TombolEkspor sibuk={sibuk} salin={salin} unduh={unduh} className="max-w-[400px]" />
        </div>
    );
}
