// =============================================================================
// DiBeliin Admin - Checkout Process
// =============================================================================
// Halaman terpisah buat pantau SATU checkout job — dari tombol "Proses Checkout"
// di Calculator (langsung diarahkan ke sini setelah submit), atau dari klik
// "Detail" di Riwayat Checkout. Sengaja dipisah dari Calculator supaya kalkulator
// tetap fokus untuk hitung-hitungan, bukan jadi tempat pantau progres checkout.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/logic/orderParser';
import { getCheckoutJob, type CheckoutJob } from '@/services/checkoutJobService';
import {
    QrisImage,
    CheckoutStatusBadge,
    PaymentStatusBadge,
    OrderPhaseBadge,
    ReceiptSection,
    type KopkenCheckoutResult,
} from '@/components/operational/CheckoutResultDisplay';
import { isPaymentStatusFinal } from '@/lib/utils';

const FAILED_PAYMENT_STATUSES = ['PAYMENT_FAILED', 'PAYMENT_FAILED_TEMP', 'PAYMENT_EXPIRED'];
const ORDER_DONE_PHASE = 'Sudah diambil';

export default function CheckoutProcessPage() {
    const { jobId } = useParams<{ jobId: string }>();
    const navigate = useNavigate();
    const [job, setJob] = useState<CheckoutJob | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!jobId) return;
        getCheckoutJob(jobId)
            .then(setJob)
            .catch((e) => toast.error(e instanceof Error ? e.message : 'Gagal memuat checkout job'))
            .finally(() => setLoading(false));
    }, [jobId]);

    // Poll tiap 2 detik selagi belum bener-bener final: checkout masih
    // pending/running, status bayar belum jelas, ATAU udah dibayar tapi pesanan
    // masih diproses dapur (belum "Sudah diambil"). Payment doang bukan garis
    // finish lagi -- status pesanan (phase) bisa lanjut lama setelah bayar sukses.
    useEffect(() => {
        if (!job || job.status === 'failed') return;
        const r = job.result as KopkenCheckoutResult | null;
        const paymentStatus = r?.paymentStatus;
        if (paymentStatus && FAILED_PAYMENT_STATUSES.includes(paymentStatus)) return;
        if (job.status === 'success' && isPaymentStatusFinal(paymentStatus) && r?.phase === ORDER_DONE_PHASE) return;
        const interval = setInterval(() => {
            getCheckoutJob(job.id).then(setJob).catch(() => {});
        }, 2000);
        return () => clearInterval(interval);
    }, [job]);

    if (loading) {
        return <p className="text-sm text-slate-400">Memuat...</p>;
    }

    if (!job) {
        return (
            <div className="space-y-4">
                <p className="text-sm text-red-500">Checkout job tidak ditemukan.</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/checkout-history')}>
                    Kembali ke Riwayat Checkout
                </Button>
            </div>
        );
    }

    const r = job.result as KopkenCheckoutResult | null;

    return (
        <div className="space-y-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/checkout-history')} className="-ml-2">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali ke Riwayat Checkout
            </Button>

            <div>
                <h1 className="text-xl font-semibold text-slate-900">
                    {job.order_payload.name} — {job.order_payload.outlet}
                </h1>
                <p className="text-sm text-slate-500">
                    {job.order_payload.items.map((i) => i.name).join(', ')}
                </p>
            </div>

            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Status Checkout</CardTitle>
                        <CheckoutStatusBadge status={job.status} />
                    </div>
                    <CardDescription>
                        Dikirim {new Date(job.created_at).toLocaleString('id-ID')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Desktop: log di kiri (lebih lebar), QRIS/struk di kanan (kolom sempit tetap,
                        sesuai bentuk aslinya) — bukan numpuk vertikal di satu kolom sempit. */}
                    <div className="grid md:grid-cols-[1fr_380px] gap-6">
                        <div className="space-y-3 min-w-0">
                            <div className="max-h-[28rem] overflow-y-auto bg-slate-950 text-slate-200 rounded-lg p-2 text-[11px] font-mono space-y-0.5 break-all">
                                {job.log.length === 0 && (
                                    <p className="text-slate-500">Menunggu worker mengambil job...</p>
                                )}
                                {job.log.map((entry, i) => (
                                    <p key={i}>
                                        <span className="text-slate-500">
                                            {new Date(entry.ts).toLocaleTimeString('id-ID')}
                                        </span>{' '}
                                        {entry.msg}
                                    </p>
                                ))}
                            </div>

                            {job.status === 'success' && r && (
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-emerald-600">
                                        Order berhasil dibuat: {r.orderId ?? '-'}
                                        {r.amount != null && ` — ${formatPrice(r.amount)}`}
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        <PaymentStatusBadge paymentStatus={r.paymentStatus} />
                                        <OrderPhaseBadge paymentStatus={r.paymentStatus} phase={r.phase} />
                                    </div>
                                </div>
                            )}

                            {job.status === 'failed' && (
                                <p className="text-xs text-red-600">Error: {r?.error ?? 'Unknown error'}</p>
                            )}
                        </div>

                        {job.status === 'success' && r && (
                            <div className="space-y-3">
                                {r.qrOrRedirect && !isPaymentStatusFinal(r.paymentStatus) && (
                                    <QrisImage qrisString={r.qrOrRedirect} />
                                )}
                                <ReceiptSection
                                    job={job}
                                    onJobUpdate={setJob}
                                    imageClassName="max-w-[200px] md:max-w-[360px]"
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
