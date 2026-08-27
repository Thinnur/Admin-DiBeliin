// =============================================================================
// DiBeliin Admin - Checkout Result Display
// =============================================================================
// Shared QR/status/receipt rendering for a checkout_jobs row — dipakai di
// Calculator (panel live setelah submit) dan CheckoutHistory (riwayat).

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import foreLogo from '@/assets/fore-logo.svg';
import { ChevronLeft, Download, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, downloadFile } from '@/lib/utils';
import {
    getCheckoutJob,
    requestReceiptRefresh,
    type CheckoutJob,
} from '@/services/checkoutJobService';
import { useEksporGambar, TombolEkspor } from './useEksporGambar';
import { KopkenPickupCard, type KopkenReceiptData } from './KopkenPickupScreen';

export interface KopkenCheckoutResult {
    orderId?: string;
    qrOrRedirect?: string;
    receiptUrl?: string;
    receiptRefreshedAt?: string;
    amount?: number;
    error?: string;
    /** Diisi belakangan oleh payment_status_worker.js (polling d5rk) — null = belum sempat dicek. */
    paymentStatus?: string | null;
    queueNumber?: string | null;
    /** Status pesanan dari dapur/outlet — salah satu dari `phases`, urutan tetap:
     * "Sedang Diproses" -> "Ambil Sekarang" -> "Sudah diambil". Cuma keisi kalau
     * paymentStatus udah sukses (order-nya baru mulai diproses dapur setelah dibayar). */
    phase?: string | null;
    phases?: string[] | null;
    orderStatus?: string | null;
    statusTitle?: string | null;
    statusDesc?: string | null;
    paymentCheckedAt?: string;
    /** ISO batas waktu bayar (Fore: dari `payment_timeout` order). Null = tidak diketahui. */
    paymentExpiresAt?: string | null;
    /** Struk yang digambar sendiri di admin, bukan gambar jadi dari luar.
     *  Bentuknya beda per brand: Fore dari endpoint struk resminya, Kopken
     *  dari d5rk (order-status) — dibedakan lewat `order_payload.brand`. */
    receipt?: ForeReceiptData | KopkenReceiptData | null;
}

export interface ForeReceiptData {
    npwp?: string;
    companyName?: string;
    orderId?: number;
    orderCode?: string;
    storeName?: string | null;
    customerName?: string | null;
    orderDate?: string | null;
    deliveryType?: string | null;
    status?: string | null;
    queue?: number;
    currency?: string;
    paymentMethod?: string | null;
    items?: { name: string; size?: string | null; qty: number; total: number; options?: string[] }[];
    totalItems?: number;
    subtotal?: number | null;
    vouchers?: { name: string; amount: number }[];
    discount?: number | null;
    deliveryFee?: number | null;
    net?: number | null;
    taxes?: { name: string; value: number }[];
    total?: number | null;
    wifi?: { name: string; password: string } | null;
    /** Isi QR pengambilan — hanya terisi saat pesanan `ready_for_pickup`. */
    pickupQr?: string | null;
}

/** Rp 33.000 — spasi setelah "Rp" mengikuti struk asli Fore. */
const rp = (n?: number | null) =>
    typeof n === 'number' ? `Rp ${Math.round(n).toLocaleString('id-ID')}` : '—';

/** Nilai pajak di struk asli tidak dibulatkan (mis. "Rp 4568.18"). */
const rpRaw = (n?: number | null) =>
    typeof n === 'number' ? `Rp ${Number(n.toFixed(2))}` : '—';

const TIPE_ORDER: Record<string, string> = {
    take_away: 'Take Away Order',
    dine_in: 'Dine In Order',
    delivery: 'Delivery Order',
};

function Putus() {
    return <div className="my-3 border-t border-dashed border-slate-300" />;
}

/**
 * Struk Fore digambar ulang di admin supaya tidak perlu membuka situs lain.
 *
 * Datanya dari endpoint struk resmi Fore (`user/order-offline/receipt/{hash}`,
 * publik tanpa token) — bukan disusun sendiri — jadi PB1, net sales, wifi, dan
 * pilihan mana yang non-default persis sama dengan yang dilihat pelanggan.
 * `url_webview_e_receipt` sendiri tidak bisa di-embed: itu SPA kosong yang baru
 * terisi setelah JS-nya jalan.
 */
/**
 * Replika layar "Complete Order" aplikasi Fore, supaya gambar yang dikirim ke
 * pelanggan terlihat sama seperti dari aplikasi aslinya.
 *
 * Tata letak & ukuran disalin dari Compose di APK (`defpackage.oc5`):
 * judul 16sp semibold, jarak dp6x, QR 220dp, logo 54dp, jarak dp2x, label 14sp
 * (nomor antrean bold + " - " + nama), jarak dp5x, pembatas "or"
 * (`R.string.checkout_or_text`, 14sp, padding dp1_5x/dp1x), lalu tombol
 * SECONDARY "Complete without Scan" 14sp. Skala dpNx = N x 8dp.
 *
 * Tombol "Complete without Scan" sengaja dirender sebagai <div>, BUKAN tombol:
 * ini bagian dari gambar, dan di aplikasi tombol itu menandai pesanan selesai
 * (`order/completed/{id}`) — jangan sampai ter-klik dari admin tanpa diminta.
 */
export function ForePickupScreen({ data }: { data: ForeReceiptData }) {
    const [dataUrl, setDataUrl] = useState<string | null>(null);
    const nilai = data.pickupQr ?? '';

    useEffect(() => {
        if (!nilai) return;
        let batal = false;
        // errorCorrectionLevel 'H' WAJIB: logo menutup ~24,5% sisi QR (54dp di
        // atas 220dp, sesuai aplikasi). Diuji headless: masih terbaca sampai
        // ~28%, putus di 30%.
        QRCode.toDataURL(nilai, { width: 440, margin: 0, errorCorrectionLevel: 'H' })
            .then((url) => { if (!batal) setDataUrl(url); })
            .catch(() => { if (!batal) setDataUrl(null); });
        return () => { batal = true; };
    }, [nilai]);

    if (!nilai || !dataUrl) return null;

    return (
        // Setinggi layar ponsel penuh (411 x 824 dp). Posisi tiap elemen diukur
        // dari screenshot aplikasi: skala 220dp QR / 507px QR = 0,434 dp per px,
        // jadi lebar layar 924px -> 401dp dan tinggi 1900px -> 824dp. Bilah
        // status ponsel (jam/baterai) sengaja TIDAK ditiru — itu chrome sistem,
        // bukan UI Fore, dan jam palsu di gambar cuma bikin bingung.
        <div className="mx-auto flex h-[824px] w-[411px] flex-col bg-white font-sans">
            {/* Header — judul di ~57dp dari atas */}
            <div className="relative flex h-14 shrink-0 items-center justify-center px-4">
                <ChevronLeft className="absolute left-4 h-6 w-6 text-[#1F2429]" strokeWidth={2.5} />
                <span className="text-lg font-bold text-[#1F2429]">Complete Order</span>
            </div>

            {/* Jarak besar sebelum judul — di aplikasi judul jatuh di ~237dp */}
            <div className="flex flex-col items-center px-4 pt-[168px]">
                <p className="w-full whitespace-nowrap text-center text-[17px] font-bold leading-snug text-[#1F2429]">
                    Scan the QR code when pick up your order!
                </p>

                {/* QR 220dp + logo 54dp */}
                <div className="relative mt-12 h-[220px] w-[220px]">
                    <img src={dataUrl} alt="QR pengambilan pesanan" className="h-full w-full" />
                    <div className="absolute left-1/2 top-1/2 flex h-[54px] w-[54px] -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-white">
                        <img src={foreLogo} alt="" className="h-[38px] w-[38px]" />
                    </div>
                </div>

                <p className="mt-4 text-center text-sm text-[#858A8E]">
                    {data.queue != null && <span className="font-bold text-[#1F2429]">{data.queue}</span>}
                    {data.customerName ? ` - ${data.customerName}` : ''}
                </p>

                {/* Pembatas "or" */}
                <div className="mt-10 flex w-full items-center">
                    <div className="h-px flex-1 bg-[#E3E3E3]" />
                    <span className="px-3 py-2 text-sm text-[#858A8E]">or</span>
                    <div className="h-px flex-1 bg-[#E3E3E3]" />
                </div>

                {/* Tombol tiruan — lihat catatan di JSDoc, sengaja tidak bisa diklik */}
                <div className="mt-10 w-full rounded-full border-2 border-[#00623B] px-6 py-3 text-center text-sm font-bold text-[#00623B]">
                    Complete without Scan
                </div>
            </div>
        </div>
    );
}

export function ForePickupCard({ data, fileName }: { data: ForeReceiptData; fileName?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const eksport = useEksporGambar(
        ref,
        `QR_Ambil_Fore_${fileName ?? data.orderCode ?? data.orderId ?? 'pesanan'}.png`,
        'QR pengambilan'
    );

    if (!data.pickupQr) return null;
    return (
        <div className="space-y-2">
            <div ref={ref} className="w-fit bg-white">
                <ForePickupScreen data={data} />
            </div>
            <TombolEkspor {...eksport} className="max-w-[360px]" />
        </div>
    );
}

/**
 * Struk + tombol ekspor gambar.
 *
 * Gambarnya dibuat dari node DOM struk itu sendiri (html-to-image), bukan
 * digambar ulang di canvas — supaya PNG-nya dijamin sama persis dengan yang
 * tampil, dan tidak ada dua tata letak yang harus dijaga tetap sinkron.
 */
export function ForeReceiptCard({ data, fileName }: { data: ForeReceiptData; fileName?: string }) {
    const strukRef = useRef<HTMLDivElement>(null);
    const eksport = useEksporGambar(
        strukRef,
        `Struk_Fore_${fileName ?? data.orderCode ?? data.orderId ?? 'pesanan'}.png`,
        'Struk'
    );

    return (
        <div className="space-y-2">
            <div ref={strukRef} className="bg-white">
                <ForeReceipt data={data} />
            </div>
            <TombolEkspor {...eksport} className="max-w-[340px]" />
        </div>
    );
}

export function ForeReceipt({ data }: { data: ForeReceiptData }) {
    return (
        <div className="mx-auto max-w-[340px]">
            <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-[12px] leading-relaxed text-slate-700">
                <div className="space-y-0.5 text-center">
                    <p className="text-base font-bold text-slate-900">Fore Coffee</p>
                    {data.storeName && <p>{data.storeName}</p>}
                    {data.npwp && <p className="text-[11px]">NPWP : {data.npwp}</p>}
                    {data.companyName && <p className="text-[11px]">{data.companyName}</p>}
                </div>

                <Putus />

                <div className="space-y-0.5 text-center">
                    <p className="text-2xl font-bold tracking-wide text-slate-900">{data.queue || '—'}</p>
                    {data.deliveryType && (
                        <p className="text-[11px]">{TIPE_ORDER[data.deliveryType] ?? data.deliveryType}</p>
                    )}
                </div>

                <div className="mt-2 space-y-0.5">
                    {data.customerName && <p>Nama Customer: {data.customerName}</p>}
                    {data.orderDate && <p>{data.orderDate}</p>}
                    {data.orderCode && <p>#{data.orderCode}</p>}
                </div>

                <Putus />

                <div className="flex justify-between font-semibold text-slate-900">
                    <span>Order</span>
                    <span>Total Order: {data.totalItems ?? 0}</span>
                </div>

                <div className="mt-2 space-y-2">
                    {(data.items ?? []).map((item, i) => (
                        <div key={i}>
                            <div className="flex justify-between gap-3">
                                <span>
                                    <span className="text-slate-400">{item.qty} x </span>
                                    {item.size ? `${item.size} ` : ''}{item.name}
                                </span>
                                <span className="whitespace-nowrap tabular-nums">{rp(item.total)}</span>
                            </div>
                            {item.options && item.options.length > 0 && (
                                <p className="pl-5 text-slate-500">{item.options.join(', ')}</p>
                            )}
                        </div>
                    ))}
                </div>

                <Putus />

                <div className="space-y-1">
                    <Baris label="Sub Total" value={rp(data.subtotal)} />
                    {(data.vouchers ?? []).map((v, i) => (
                        <Baris key={i} label={`Voucher Discount : ${v.name}`} value={`-${rp(v.amount)}`} />
                    ))}
                    {!!data.deliveryFee && <Baris label="Delivery Fee" value={rp(data.deliveryFee)} />}
                    <div className="flex justify-between gap-3 font-semibold text-slate-900">
                        <span>SUBTOTAL</span>
                        <span className="tabular-nums">{rp(data.total)}</span>
                    </div>
                </div>

                <Putus />

                <div className="space-y-1">
                    <Baris label="Net sales" value={rp(data.net)} />
                    {(data.taxes ?? []).map((t, i) => (
                        <Baris key={i} label={t.name} value={rpRaw(t.value)} />
                    ))}
                </div>

                <Putus />

                <div className="space-y-1">
                    <div className="flex justify-between gap-3 font-semibold text-slate-900">
                        <span>Total Pembayaran</span>
                        <span className="tabular-nums">{rp(data.total)}</span>
                    </div>
                    {data.paymentMethod && <Baris label="Metode Pembayaran" value={data.paymentMethod} />}
                </div>

                {data.wifi && (
                    <>
                        <Putus />
                        <div className="space-y-0.5 text-center">
                            <p className="font-semibold text-slate-900">FREE WIFI</p>
                            <p>{data.wifi.name}</p>
                            <p>Pass: {data.wifi.password}</p>
                        </div>
                    </>
                )}

                <Putus />

                <p className="text-center text-base font-semibold text-slate-900">Terima Kasih</p>
            </div>
        </div>
    );
}

function Baris({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-3">
            <span>{label}</span>
            <span className="whitespace-nowrap tabular-nums">{value}</span>
        </div>
    );
}


/**
 * Hitung mundur batas bayar QRIS. Berhenti sendiri saat habis supaya tidak
 * terus-menerus me-render setelah tidak relevan.
 */
export function PaymentCountdown({ expiresAt }: { expiresAt?: string | null }) {
    const [sisaMs, setSisaMs] = useState(() => (expiresAt ? Date.parse(expiresAt) - Date.now() : 0));

    useEffect(() => {
        if (!expiresAt) return;
        const hitung = () => setSisaMs(Date.parse(expiresAt) - Date.now());
        hitung();
        const id = setInterval(hitung, 1000);
        return () => clearInterval(id);
    }, [expiresAt]);

    if (!expiresAt || Number.isNaN(Date.parse(expiresAt))) return null;

    if (sisaMs <= 0) {
        return <span className="text-[11px] font-medium text-red-600">Batas bayar habis</span>;
    }

    const totalDetik = Math.floor(sisaMs / 1000);
    const menit = Math.floor(totalDetik / 60);
    const detik = totalDetik % 60;
    const mendesak = sisaMs < 2 * 60 * 1000;

    return (
        <span className={cn('text-[11px] font-medium tabular-nums', mendesak ? 'text-red-600' : 'text-slate-500')}>
            Bayar dalam {menit}:{String(detik).padStart(2, '0')}
        </span>
    );
}

/** Render string QRIS mentah jadi gambar QR code langsung di browser (tanpa API pihak ketiga). */
export function QrisImage({ qrisString }: { qrisString: string }) {
    const [dataUrl, setDataUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        QRCode.toDataURL(qrisString, { width: 220, margin: 1 })
            .then((url) => { if (!cancelled) setDataUrl(url); })
            .catch(() => { if (!cancelled) setDataUrl(null); });
        return () => { cancelled = true; };
    }, [qrisString]);

    if (!dataUrl) return null;
    return (
        <div className="flex flex-col items-center gap-1 pt-1">
            <img src={dataUrl} alt="QRIS" className="w-40 h-40 rounded-lg border border-slate-200" />
            <span className="text-[11px] text-slate-500">Scan QRIS untuk bayar</span>
        </div>
    );
}

export function CheckoutStatusBadge({ status }: { status: CheckoutJob['status'] }) {
    const meta: Record<CheckoutJob['status'], { label: string; className: string }> = {
        pending: { label: 'Menunggu', className: 'bg-slate-100 text-slate-600 border-slate-200' },
        running: { label: 'Diproses...', className: 'bg-blue-50 text-blue-700 border-blue-200' },
        success: { label: 'Sukses', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        failed: { label: 'Gagal', className: 'bg-red-50 text-red-700 border-red-200' },
        cancelled: { label: 'Dibatalkan', className: 'bg-slate-100 text-slate-500 border-slate-200' },
    };
    const { label, className } = meta[status];
    return <Badge variant="outline" className={className}>{label}</Badge>;
}

/** Status pembayaran REAL (beda dari CheckoutStatusBadge, yang cuma nunjukin order-nya berhasil dibuat atau tidak). */
export function PaymentStatusBadge({ paymentStatus }: { paymentStatus?: string | null }) {
    if (!paymentStatus) {
        return (
            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200">
                Belum dicek
            </Badge>
        );
    }
    if (paymentStatus === 'PAYMENT_PENDING') {
        return (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                Menunggu Bayar
            </Badge>
        );
    }
    if (paymentStatus.includes('EXPIRED')) {
        return (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                Kadaluarsa
            </Badge>
        );
    }
    if (paymentStatus.includes('FAILED')) {
        return (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                Gagal Bayar
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            Sudah Dibayar
        </Badge>
    );
}

const ORDER_DONE_PHASE = 'Sudah diambil';
const ORDER_READY_PHASE = 'Ambil Sekarang';
const FAILED_PAYMENT_STATUSES = ['PAYMENT_PENDING', 'PAYMENT_FAILED', 'PAYMENT_FAILED_TEMP', 'PAYMENT_EXPIRED'];

/** Status pesanan dari dapur/outlet (BEDA dari PaymentStatusBadge yang cuma soal
 * bayar) — diisi payment_status_worker.js (polling d5rk), progres tetap: Sedang
 * Diproses -> Ambil Sekarang -> Sudah diambil. Order belum masuk antrian dapur
 * sebelum dibayar, jadi belum ada status buat ditampilkan. */
export function OrderPhaseBadge({ paymentStatus, phase }: { paymentStatus?: string | null; phase?: string | null }) {
    const isPaid = paymentStatus && !FAILED_PAYMENT_STATUSES.includes(paymentStatus);
    if (!isPaid || !phase) {
        return <Badge variant="outline" className="bg-slate-100 text-slate-400 border-slate-200">—</Badge>;
    }
    if (phase === ORDER_DONE_PHASE) {
        return (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                Pesanan Selesai
            </Badge>
        );
    }
    if (phase === ORDER_READY_PHASE) {
        return (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 animate-pulse">
                Siap Diambil
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Sedang Diproses
        </Badge>
    );
}

/**
 * Preview struk (dikecilkan, bukan full-width) + tombol Download & Perbarui.
 * Struk otomatis diambil begitu order dibuat — SEBELUM dibayar — jadi belum ada
 * nomor antrian/QR pickup di dalamnya. "Perbarui" minta payment_status_worker.js
 * ambil ulang (result.receiptUrl sama, upsert — cache-bust pakai receiptRefreshedAt).
 */
export function ReceiptSection({
    job,
    onJobUpdate,
    imageClassName = 'max-w-[200px]',
}: {
    job: CheckoutJob;
    onJobUpdate: (job: CheckoutJob) => void;
    /** Lebar preview struk — default kecil (dipakai di panel Calculator/Riwayat). */
    imageClassName?: string;
}) {
    const r = job.result as KopkenCheckoutResult | null;
    const [refreshing, setRefreshing] = useState(false);
    const [downloading, setDownloading] = useState(false);

    // Struk Fore digambar sendiri dari data order. `url_webview_e_receipt`
    // sengaja tidak dipakai: itu PNG-nya Kopken yang punya, sedangkan Fore
    // mengembalikan SPA kosong tanpa identitas order — dirender sebagai <img>
    // hasilnya gambar rusak, di-iframe pun kosong.
    if (job.order_payload?.brand === 'fore') {
        if (!r?.receipt) {
            return job.status === 'success' ? (
                <p className="text-[11px] text-slate-400">
                    Struk belum tersedia — menunggu pembaruan status dari fore_status_worker.
                </p>
            ) : null;
        }
        return (
                    <div className="space-y-6">
                        <ForePickupCard data={r.receipt as ForeReceiptData} fileName={r.orderId} />
                        <ForeReceiptCard data={r.receipt as ForeReceiptData} fileName={r.orderId} />
                    </div>
                );
    }

    // Sama-sama minta payment_status_worker.js ambil struk (via
    // receipt_refresh_requested_at) — dipakai baik buat "Perbarui" (struk udah
    // ada, minta yang terbaru) MAUPUN "Minta Struk" (struk belum pernah
    // berhasil keambil sama sekali, worker gagal pas checkout awal).
    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await requestReceiptRefresh(job.id);
            for (let i = 0; i < 15; i++) {
                await new Promise((resolve) => setTimeout(resolve, 3000));
                const fresh = await getCheckoutJob(job.id);
                onJobUpdate(fresh);
                if (!fresh.receipt_refresh_requested_at) break; // worker sudah selesai proses (sukses/gagal)
            }
        } finally {
            setRefreshing(false);
        }
    };

    // Kopken juga digambar sendiri sekarang, dari data d5rk yang disimpan
    // worker di `result.receipt`. Job lama (sebelum perubahan ini) tidak punya
    // field itu dan jatuh ke cabang `receiptUrl` di bawah — screenshot kopsu
    // yang lama tetap tampil, jadi riwayat tidak jadi kosong.
    if (r?.receipt) {
        return (
            <div className="space-y-3">
                <KopkenPickupCard data={r.receipt as KopkenReceiptData} fileName={r.orderId} />
                <Button variant="outline" size="sm" className="w-full" onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Memperbarui...' : 'Perbarui Status'}
                </Button>
            </div>
        );
    }

    if (!r?.receiptUrl) {
        // Worker gagal ambil struk pas checkout (mis. koneksi putus, timeout) --
        // sebelumnya cuma teks statis tanpa cara manual minta ulang, admin harus
        // nunggu tanpa kepastian. Sekarang ada tombol yang manggil mekanisme
        // refresh yang sama; jalan asal result.phone/orderId ada (selalu ada
        // begitu order berhasil dibuat, independen dari sukses-tidaknya fetch struk).
        return job.status === 'success' ? (
            <div className="space-y-2">
                <p className="text-[11px] text-slate-400">Struk belum tersedia (worker gagal mengambil, atau masih proses).</p>
                <Button variant="outline" size="sm" className="w-full" onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Mengambil struk...' : 'Minta Struk'}
                </Button>
            </div>
        ) : null;
    }

    const handleDownload = async () => {
        setDownloading(true);
        try {
            await downloadFile(r.receiptUrl!, `Struk_${r.orderId ?? job.id}.png`);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="space-y-2">
            <img
                src={`${r.receiptUrl}?t=${r.receiptRefreshedAt ?? job.updated_at}`}
                alt="Struk pesanan"
                className={cn('mx-auto rounded-lg border border-slate-200', imageClassName)}
            />
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleDownload}
                    disabled={downloading}
                >
                    <Download className={`w-3.5 h-3.5 mr-1.5 ${downloading ? 'animate-bounce' : ''}`} />
                    {downloading ? 'Mengunduh...' : 'Download'}
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Memperbarui...' : 'Perbarui Struk'}
                </Button>
            </div>
        </div>
    );
}
