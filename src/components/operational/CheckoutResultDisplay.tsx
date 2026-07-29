// =============================================================================
// DiBeliin Admin - Checkout Result Display
// =============================================================================
// Shared QR/status/receipt rendering for a checkout_jobs row — dipakai di
// Calculator (panel live setelah submit) dan CheckoutHistory (riwayat).

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, RefreshCw } from 'lucide-react';

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
