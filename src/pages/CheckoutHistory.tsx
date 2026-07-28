// =============================================================================
// DiBeliin Admin - Checkout History
// =============================================================================
// Riwayat semua job checkout Kopken (dari tombol "Proses Checkout" di Calculator):
// cek order yang masih menunggu discan QRIS, download struk, atau lihat kenapa gagal.
// Klik baris/"Detail" membuka halaman tersendiri (/checkout-process/:jobId).

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

import { formatPrice } from '@/lib/logic/orderParser';
import {
    listCheckoutJobs,
    type CheckoutJob,
    type CheckoutJobStatus,
} from '@/services/checkoutJobService';
import {
    CheckoutStatusBadge,
    PaymentStatusBadge,
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

    const loadJobs = useCallback(async () => {
        setLoading(true);
        try {
            setJobs(await listCheckoutJobs());
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Gagal memuat riwayat checkout');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadJobs();
    }, [loadJobs]);

    const filteredJobs = statusFilter === 'all' ? jobs : jobs.filter((j) => j.status === statusFilter);

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
                            </SelectContent>
                        </Select>
                    </div>
                    <CardDescription>
                        Klik salah satu baris buat lihat detail (QRIS, struk, log lengkap)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredJobs.length === 0 && !loading && (
                        <p className="text-sm text-slate-400 text-center py-8">Belum ada order.</p>
                    )}
                    {filteredJobs.length > 0 && (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Waktu</TableHead>
                                        <TableHead>Pesanan</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Pembayaran</TableHead>
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
                                                <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                                                    {formatDateTime(job.created_at)}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="font-medium text-slate-800">
                                                        {job.order_payload.name} — {job.order_payload.outlet}
                                                    </div>
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
