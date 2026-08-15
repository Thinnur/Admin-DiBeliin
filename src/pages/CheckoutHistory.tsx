// =============================================================================
// DiBeliin Admin - Checkout History
// =============================================================================
// Riwayat semua job checkout Kopken (dari tombol "Proses Checkout" di Calculator):
// cek order yang masih menunggu discan QRIS, download struk, atau lihat kenapa gagal.
// Klik baris/"Detail" membuka halaman tersendiri (/checkout-process/:jobId).

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
import {
    listCheckoutJobs,
    deleteCheckoutJobs,
    type CheckoutJob,
    type CheckoutJobStatus,
} from '@/services/checkoutJobService';
import {
    CheckoutStatusBadge,
    PaymentStatusBadge,
    OrderPhaseBadge,
    type KopkenCheckoutResult,
} from '@/components/operational/CheckoutResultDisplay';

type StatusFilter = CheckoutJobStatus | 'all';

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function CheckoutHistoryPage() {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState<CheckoutJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);

    const loadJobs = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setLoading(true);
        try {
            setJobs(await listCheckoutJobs(2000));
        } catch (e) {
            if (!opts?.silent) toast.error(e instanceof Error ? e.message : 'Gagal memuat riwayat checkout');
        } finally {
            if (!opts?.silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadJobs();
    }, [loadJobs]);

    // Ganti auto-refresh 10 detik (yang narik ulang sampai 2000 baris penuh)
    // dengan Realtime: dengerin INSERT/UPDATE/DELETE di checkout_jobs dan
    // merge ke state lokal -- cuma baris yang bener-bener berubah yang
    // ke-transfer, bukan seluruh riwayat tiap tick.
    // PENTING: merge di atas baris existing, jangan replace total -- kolom
    // TOASTed (log, kadang order_payload) yang gak ikut berubah di suatu
    // UPDATE bakal absen dari payload.new sama sekali (logical replication
    // cuma kirim yang berubah). Replace total bikin field itu jadi undefined
    // dan nge-crash render (mis. job.order_payload.items.map di baris list).
    useEffect(() => {
        const channel = supabase
            .channel('checkout_jobs_history')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'checkout_jobs' },
                (payload) => {
                    setJobs((prev) => {
                        if (payload.eventType === 'DELETE') {
                            const oldId = (payload.old as { id: string }).id;
                            return prev.filter((j) => j.id !== oldId);
                        }
                        const incomingId = (payload.new as { id: string }).id;
                        const existing = prev.find((j) => j.id === incomingId);
                        // log gak dipakai di list view (lihat listCheckoutJobs) -- buang
                        // biar konsisten sama shape awal, bukan cuma soal state size.
                        const merged = { ...existing, ...(payload.new as CheckoutJob), log: [] } as CheckoutJob;
                        const next = existing
                            ? prev.map((j) => (j.id === incomingId ? merged : j))
                            : [merged, ...prev];
                        return next.sort((a, b) => b.created_at.localeCompare(a.created_at));
                    });
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const statusFilteredJobs = statusFilter === 'all' ? jobs : jobs.filter((j) => j.status === statusFilter);

    // Tanggal unik (yyyy-MM-dd) dari job yang lolos filter status, terbaru dulu.
    const uniqueDays = useMemo(() => {
        const days = statusFilteredJobs.map((j) => format(new Date(j.created_at), 'yyyy-MM-dd'));
        return Array.from(new Set(days)).sort((a, b) => b.localeCompare(a));
    }, [statusFilteredJobs]);

    const activeDay = (selectedDay && uniqueDays.includes(selectedDay))
        ? selectedDay
        : (uniqueDays[0] || null);

    const filteredJobs = useMemo(() => {
        if (!activeDay) return [];
        return statusFilteredJobs.filter(
            (j) => format(new Date(j.created_at), 'yyyy-MM-dd') === activeDay
        );
    }, [statusFilteredJobs, activeDay]);

    // Selection cuma relevan buat baris yang lagi kelihatan (sesuai filter status + hari aktif).
    useEffect(() => {
        setSelectedIds((prev) => {
            const visibleIds = new Set(filteredJobs.map((j) => j.id));
            const next = new Set([...prev].filter((id) => visibleIds.has(id)));
            return next.size === prev.size ? prev : next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, activeDay, jobs]);

    const allVisibleSelected = filteredJobs.length > 0 && filteredJobs.every((j) => selectedIds.has(j.id));

    const toggleSelectAll = () => {
        setSelectedIds(allVisibleSelected ? new Set() : new Set(filteredJobs.map((j) => j.id)));
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleDeleteSelected = async () => {
        setDeleting(true);
        try {
            await deleteCheckoutJobs([...selectedIds]);
            toast.success(`${selectedIds.size} riwayat berhasil dihapus.`);
            setSelectedIds(new Set());
            await loadJobs();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Gagal menghapus riwayat');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-slate-900">Riwayat Checkout</h1>
                    <p className="text-sm text-slate-500">
                        Semua order Kopken yang diproses lewat Calculator — cek status, QRIS, atau struk
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadJobs} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                            Order ({filteredJobs.length})
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {selectedIds.size > 0 && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm" disabled={deleting}>
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Hapus ({selectedIds.size})
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Hapus {selectedIds.size} riwayat checkout?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Baris riwayat DAN foto struk yang tersimpan bakal dihapus permanen dari server.
                                                Tindakan ini tidak bisa dibatalkan.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleDeleteSelected}
                                                className="bg-red-500 hover:bg-red-600"
                                            >
                                                Hapus
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua status</SelectItem>
                                    <SelectItem value="pending">Menunggu</SelectItem>
                                    <SelectItem value="running">Diproses</SelectItem>
                                    <SelectItem value="success">Sukses</SelectItem>
                                    <SelectItem value="failed">Gagal</SelectItem>
                                    <SelectItem value="cancelled">Dibatalkan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <CardDescription>
                        Klik salah satu baris buat lihat detail (QRIS, struk, log lengkap)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Tab Filter Hari */}
                    {uniqueDays.length > 0 && (
                        <div className="mb-4 overflow-x-auto pb-2 -mx-1 px-1">
                            <Tabs
                                value={activeDay || ''}
                                onValueChange={(val) => setSelectedDay(val || null)}
                            >
                                <TabsList className="inline-flex w-auto bg-slate-100 p-1 rounded-lg">
                                    {uniqueDays.map((dayStr) => {
                                        const date = new Date(dayStr);
                                        let label = format(date, 'd MMM yyyy', { locale: localeId });
                                        if (isToday(date)) {
                                            label = 'Hari Ini';
                                        } else if (isYesterday(date)) {
                                            label = 'Kemarin';
                                        }
                                        return (
                                            <TabsTrigger
                                                key={dayStr}
                                                value={dayStr}
                                                className="text-xs px-3 py-1.5 whitespace-nowrap data-[state=active]:bg-white data-[state=active]:text-slate-900"
                                            >
                                                {label}
                                            </TabsTrigger>
                                        );
                                    })}
                                </TabsList>
                            </Tabs>
                        </div>
                    )}

                    {filteredJobs.length === 0 && !loading && (
                        <p className="text-sm text-slate-400 text-center py-8">Belum ada order.</p>
                    )}
                    {filteredJobs.length > 0 && (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10">
                                            <input
                                                type="checkbox"
                                                checked={allVisibleSelected}
                                                onChange={toggleSelectAll}
                                                className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                                                aria-label="Pilih semua"
                                            />
                                        </TableHead>
                                        <TableHead>Waktu</TableHead>
                                        <TableHead>Pesanan</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Pembayaran</TableHead>
                                        <TableHead>Status Pesanan</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="w-24"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredJobs.map((job) => {
                                        const r = job.result as KopkenCheckoutResult | null;
                                        return (
                                            <TableRow
                                                key={job.id}
                                                className="cursor-pointer hover:bg-slate-50/50"
                                                onClick={() => navigate(`/checkout-process/${job.id}`)}
                                            >
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(job.id)}
                                                        onChange={() => toggleSelectOne(job.id)}
                                                        className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                                                        aria-label={`Pilih order ${job.id}`}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                                                    {formatDateTime(job.created_at)}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="font-medium text-slate-800">
                                                        {job.order_payload.name} — {job.order_payload.outlet}
                                                    </div>
                                                    {job.order_payload.orderNumber && (
                                                        <div className="text-xs text-slate-500">
                                                            Order #{job.order_payload.orderNumber}
                                                            {job.order_payload.groupIndex && job.order_payload.groupTotal
                                                                ? ` · Akun ${job.order_payload.groupIndex}/${job.order_payload.groupTotal}`
                                                                : ''}
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-slate-500">
                                                        {job.order_payload.items.map((i) => i.name).join(', ')}
                                                    </div>
                                                </TableCell>
                                                <TableCell><CheckoutStatusBadge status={job.status} /></TableCell>
                                                <TableCell>
                                                    {job.status === 'success' && (
                                                        <PaymentStatusBadge paymentStatus={r?.paymentStatus} />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {job.status === 'success' && (
                                                        <OrderPhaseBadge paymentStatus={r?.paymentStatus} phase={r?.phase} />
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-sm font-medium">
                                                    {formatPrice(r?.amount ?? job.order_payload.subtotal)}
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm">Detail</Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
