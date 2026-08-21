// =============================================================================
// DiBeliin Admin - Checkout Result Display
// =============================================================================
// Shared QR/status/receipt rendering for a checkout_jobs row — dipakai di
// Calculator (panel live setelah submit) dan CheckoutHistory (riwayat).

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { toBlob } from 'html-to-image';
import { toast } from 'sonner';
import { Copy, Download, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, downloadFile } from '@/lib/utils';
import {
    getCheckoutJob,
    requestReceiptRefresh,
    type CheckoutJob,
} from '@/services/checkoutJobService';

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
    /** Fore: struk dari endpoint resmi Fore, dirender langsung di sini. */
    receipt?: ForeReceiptData | null;
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
 * QR pengambilan pesanan. Fore hanya menampilkannya saat status
 * `ready_for_pickup`, dan isinya `is_hash ? uorsh_hash : uor_code`
 * (disalin dari bundle track.fore.coffee) — sudah dihitung di backend
 * jadi di sini tinggal digambar.
 */
export function PickupQr({ value, orderId }: { value: string; orderId?: number }) {
    const [dataUrl, setDataUrl] = useState<string | null>(null);

    useEffect(() => {
        let batal = false;
        QRCode.toDataURL(value, { width: 260, margin: 1 })
            .then((url) => { if (!batal) setDataUrl(url); })
            .catch(() => { if (!batal) setDataUrl(null); });
        return () => { batal = true; };
    }, [value]);

    if (!dataUrl) return null;
    return (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <span className="text-[11px] font-semibold tracking-wide text-amber-800">
                SCAN UNTUK MENGAMBIL PESANANMU
            </span>
            {!!orderId && <span className="font-mono text-[11px] text-amber-700">{orderId}</span>}
            <img src={dataUrl} alt="QR pengambilan pesanan" className="h-44 w-44" />
        </div>
    );
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
 * Struk + tombol ekspor gambar.
 *
 * Gambarnya dibuat dari node DOM struk itu sendiri (html-to-image), bukan
 * digambar ulang di canvas — supaya PNG-nya dijamin sama persis dengan yang
 * tampil, dan tidak ada dua tata letak yang harus dijaga tetap sinkron.
 */
export function ForeReceiptCard({ data, fileName }: { data: ForeReceiptData; fileName?: string }) {
    const strukRef = useRef<HTMLDivElement>(null);
    const [sibuk, setSibuk] = useState<'salin' | 'unduh' | null>(null);

    const namaFile = `Struk_Fore_${fileName ?? data.orderCode ?? data.orderId ?? 'pesanan'}.png`;

    // pixelRatio 2 supaya teks struk tetap tajam saat dizoom / dikirim ke WA.
    const buatBlob = () =>
        toBlob(strukRef.current!, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });

    const unduh = async () => {
        setSibuk('unduh');
        try {
            const blob = await buatBlob();
            if (!blob) throw new Error('Gagal membuat gambar');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = namaFile;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Gagal mengunduh struk');
        } finally {
            setSibuk(null);
        }
    };

    const salin = async () => {
        setSibuk('salin');
        try {
            const blob = await buatBlob();
            if (!blob) throw new Error('Gagal membuat gambar');
            // Clipboard gambar butuh secure context (https / localhost) dan
            // dukungan ClipboardItem — Firefox lama tidak punya.
            if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
                throw new Error('Browser ini tidak mendukung salin gambar — pakai Download.');
            }
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            toast.success('Struk disalin sebagai gambar.');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Gagal menyalin struk');
        } finally {
            setSibuk(null);
        }
    };

    return (
        <div className="space-y-2">
            <div ref={strukRef} className="bg-white">
                <ForeReceipt data={data} />
            </div>
            <div className="mx-auto flex max-w-[340px] gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={salin} disabled={!!sibuk}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    {sibuk === 'salin' ? 'Menyalin...' : 'Salin Gambar'}
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={unduh} disabled={!!sibuk}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {sibuk === 'unduh' ? 'Mengunduh...' : 'Download PNG'}
                </Button>
            </div>
        </div>
    );
}

export function ForeReceipt({ data }: { data: ForeReceiptData }) {
    return (
        <div className="mx-auto max-w-[340px] space-y-3">
            {data.pickupQr && <PickupQr value={data.pickupQr} orderId={data.orderId} />}

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
        return <ForeReceiptCard data={r.receipt} fileName={r.orderId} />;
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
