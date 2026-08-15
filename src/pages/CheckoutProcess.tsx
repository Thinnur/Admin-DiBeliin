// =============================================================================
// DiBeliin Admin - Checkout Process
// =============================================================================
// Halaman terpisah buat pantau SATU checkout job — dari tombol "Proses Checkout"
// di Calculator (langsung diarahkan ke sini setelah submit), atau dari klik
// "Detail" di Riwayat Checkout. Sengaja dipisah dari Calculator supaya kalkulator
// tetap fokus untuk hitung-hitungan, bukan jadi tempat pantau progres checkout.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Ban } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatPrice } from '@/lib/logic/orderParser';
import { supabase } from '@/lib/supabase';
import { getCheckoutJob, cancelCheckoutJob, type CheckoutJob } from '@/services/checkoutJobService';
import {
    QrisImage,
    CheckoutStatusBadge,
    PaymentStatusBadge,
    OrderPhaseBadge,
    ReceiptSection,
    type KopkenCheckoutResult,
} from '@/components/operational/CheckoutResultDisplay';
import { isPaymentStatusFinal } from '@/lib/utils';

export default function CheckoutProcessPage() {
    const { jobId } = useParams<{ jobId: string }>();
    const navigate = useNavigate();
    const [job, setJob] = useState<CheckoutJob | null>(null);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        if (!jobId) return;
        getCheckoutJob(jobId)
            .then(setJob)
            .catch((e) => toast.error(e instanceof Error ? e.message : 'Gagal memuat checkout job'))
            .finally(() => setLoading(false));
    }, [jobId]);

    // Ganti polling 2 detik dengan Supabase Realtime: checkout_worker.js/
    // payment_status_worker.js nge-PATCH baris ini tiap ada progres (log,
    // status, result), jadi cukup dengerin UPDATE event-nya langsung --
    // gak perlu re-fetch full row tiap tick walau gak ada perubahan.
    // PENTING: merge, jangan replace total -- Postgres nge-skip kolom TOASTed
    // (mis. `log` yang udah gede) dari payload kalau UPDATE itu gak nyentuh
    // kolom tsb (logical replication cuma kirim yang berubah), jadi
    // payload.new.log bisa literally gak ada ('log' in payload.new === false).
    // Replace total bikin job.log jadi undefined -> crash pas render -> blank.
    useEffect(() => {
        if (!jobId) return;
        const channel = supabase
            .channel(`checkout_job_${jobId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'checkout_jobs', filter: `id=eq.${jobId}` },
                (payload) => setJob((prev) => (prev ? { ...prev, ...payload.new } : (payload.new as CheckoutJob)))
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [jobId]);

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
    const canCancel = job.status === 'pending' || job.status === 'running';

    const handleCancel = async () => {
        setCancelling(true);
        try {
            const outcome = await cancelCheckoutJob(job.id);
            const fresh = await getCheckoutJob(job.id);
            setJob(fresh);
            toast.success(
                outcome === 'cancelled'
                    ? 'Checkout dibatalkan.'
                    : 'Permintaan batal terkirim — worker akan berhenti sebelum submit pembayaran.'
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Gagal membatalkan checkout');
        } finally {
            setCancelling(false);
        }
    };

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
                {job.order_payload.orderNumber && (
                    <p className="text-sm text-slate-400">
                        Order #{job.order_payload.orderNumber}
                        {job.order_payload.groupTotal
                            ? ` · Akun ${job.order_payload.groupIndex}/${job.order_payload.groupTotal}`
                            : ''}
                    </p>
                )}
                <p className="text-sm text-slate-500">
                    {job.order_payload.items.map((i) => i.name).join(', ')}
                </p>
            </div>

            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Status Checkout</CardTitle>
                        <div className="flex items-center gap-2">
                            {canCancel && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={cancelling || !!job.cancel_requested_at}
                                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                        >
                                            <Ban className="w-3.5 h-3.5 mr-1.5" />
                                            {job.cancel_requested_at
                                                ? 'Membatalkan...'
                                                : cancelling
                                                    ? 'Membatalkan...'
                                                    : 'Batal'}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Batalkan checkout ini?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {job.status === 'pending'
                                                    ? 'Job masih menunggu, belum diproses worker — bisa langsung dibatalkan.'
                                                    : 'Job sedang diproses worker — akan dihentikan sebelum submit pembayaran (QRIS/voucher belum terpakai).'}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Tidak</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleCancel}
                                                className="bg-red-500 hover:bg-red-600"
                                            >
                                                Ya, Batalkan
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                            <CheckoutStatusBadge status={job.status} />
                        </div>
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

                            {job.status === 'cancelled' && (
                                <p className="text-xs text-slate-500">Dibatalkan oleh admin sebelum submit pembayaran.</p>
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
