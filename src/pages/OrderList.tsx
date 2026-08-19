import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator as CalculatorIcon, CheckCircle2, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { completeQrisOrder, deleteQrisOrder, listNewQrisOrders, type QrisOrder } from '@/services/qrisOrderService';

const AUTO_REFRESH_MS = 20_000;

const BRAND_LABEL: Record<string, string> = {
    kenangan: 'Kenangan',
    fore: 'Fore',
    tomoro: 'Tomoro',
    chatime: 'Chatime',
};
const BRAND_TABS = ['all', 'kenangan', 'fore', 'tomoro', 'chatime'] as const;
type BrandTab = (typeof BRAND_TABS)[number];

function dayKey(order: QrisOrder): string {
    const raw = order.paid_at ?? order.created_at;
    return format(new Date(raw), 'yyyy-MM-dd');
}

export default function OrderListPage() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<QrisOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [dayTab, setDayTab] = useState('all');
    const [brandTab, setBrandTab] = useState<BrandTab>('all');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [completingId, setCompletingId] = useState<string | null>(null);

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            setOrders(await listNewQrisOrders());
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat pesanan');
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const handleDelete = useCallback(async (orderId: string) => {
        setDeletingId(orderId);
        try {
            await deleteQrisOrder(orderId);
            setOrders((prev) => prev.filter((order) => order.id !== orderId));
            toast.success('Pesanan dihapus.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menghapus pesanan');
        } finally {
            setDeletingId(null);
        }
    }, []);

    const handleComplete = useCallback(async (orderId: string) => {
        setCompletingId(orderId);
        try {
            await completeQrisOrder(orderId);
            setOrders((prev) => prev.filter((order) => order.id !== orderId));
            toast.success('Pesanan ditandai selesai.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menandai pesanan selesai');
        } finally {
            setCompletingId(null);
        }
    }, []);

    // Auto-refresh diam-diam di latar belakang -- tidak menyalakan "Memuat…" biar
    // tabel tidak berkedip tiap 20 detik saat admin lagi baca daftar.
    const loadRef = useRef(load);
    loadRef.current = load;
    useEffect(() => {
        const interval = setInterval(() => void loadRef.current(true), AUTO_REFRESH_MS);
        return () => clearInterval(interval);
    }, []);

    // Tab hari: digenerate dari tanggal yang benar-benar ada di data, terbaru dulu.
    const dayTabs = useMemo(() => {
        const days = new Set(orders.map(dayKey));
        return Array.from(days).sort((a, b) => b.localeCompare(a));
    }, [orders]);

    const ordersOnSelectedDay = useMemo(
        () => (dayTab === 'all' ? orders : orders.filter((order) => dayKey(order) === dayTab)),
        [orders, dayTab]
    );

    // Badge per brand: jumlah "Belum diproses" pada hari yang sedang dilihat --
    // biar kelihatan ada pesanan baru brand lain walau admin lagi buka tab brand lain.
    const unprocessedCountByBrand = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const order of ordersOnSelectedDay) {
            if (order.status !== 'PROCESSED') {
                counts[order.brand] = (counts[order.brand] ?? 0) + 1;
            }
        }
        return counts;
    }, [ordersOnSelectedDay]);

    const visibleOrders = useMemo(
        () => (brandTab === 'all' ? ordersOnSelectedDay : ordersOnSelectedDay.filter((order) => order.brand === brandTab)),
        [ordersOnSelectedDay, brandTab]
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Pesanan Baru</h1>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button size="sm" onClick={() => navigate('/calculator/manual')}>
                        <CalculatorIcon className="mr-1 h-4 w-4" />
                        Hitung Manual
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader className="space-y-3">
                    <CardTitle>Sudah Dibayar</CardTitle>

                    {dayTabs.length > 0 && (
                        <Tabs value={dayTab} onValueChange={setDayTab}>
                            <TabsList>
                                <TabsTrigger value="all">Semua Hari</TabsTrigger>
                                {dayTabs.map((day) => (
                                    <TabsTrigger key={day} value={day}>
                                        {format(new Date(day), 'dd MMM')}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    )}

                    <Tabs value={brandTab} onValueChange={(value) => setBrandTab(value as BrandTab)}>
                        <TabsList>
                            {BRAND_TABS.map((brand) => {
                                const count = brand === 'all'
                                    ? Object.values(unprocessedCountByBrand).reduce((sum, n) => sum + n, 0)
                                    : unprocessedCountByBrand[brand] ?? 0;
                                return (
                                    <TabsTrigger key={brand} value={brand} className="gap-1.5">
                                        {brand === 'all' ? 'Semua Brand' : BRAND_LABEL[brand]}
                                        {count > 0 && (
                                            <Badge variant="destructive" className="px-1.5">
                                                {count}
                                            </Badge>
                                        )}
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">Memuat…</p>
                    ) : visibleOrders.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            {orders.length === 0
                                ? 'Belum ada pesanan baru. Order Kenangan/Fore/Tomoro/Chatime dari web muncul di sini otomatis setelah dibayar.'
                                : 'Tidak ada pesanan di filter ini.'}
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>No. Pesanan</TableHead>
                                    <TableHead>Waktu Bayar</TableHead>
                                    <TableHead>Brand</TableHead>
                                    <TableHead>Nama</TableHead>
                                    <TableHead>Outlet</TableHead>
                                    <TableHead>Item</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-20" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleOrders.map((order) => (
                                    <TableRow
                                        key={order.id}
                                        className="cursor-pointer hover:bg-slate-50/50"
                                        onClick={() => navigate(`/calculator/${order.id}`)}
                                    >
                                        <TableCell className="font-mono text-xs">{order.order_number}</TableCell>
                                        <TableCell>
                                            {order.paid_at
                                                ? format(new Date(order.paid_at), 'dd MMM HH:mm')
                                                : '—'}
                                        </TableCell>
                                        <TableCell>{BRAND_LABEL[order.brand] ?? order.brand}</TableCell>
                                        <TableCell>{order.customer_name}</TableCell>
                                        <TableCell className="max-w-[220px] truncate">{order.outlet}</TableCell>
                                        <TableCell>
                                            {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            Rp {order.total_amount.toLocaleString('id-ID')}
                                        </TableCell>
                                        <TableCell>
                                            {order.status === 'PROCESSED'
                                                ? `Diproses (${order.checkout_job_ids.length} job)`
                                                : 'Belum diproses'}
                                        </TableCell>
                                        <TableCell onClick={(event) => event.stopPropagation()} className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                                disabled={completingId === order.id}
                                                title="Tandai selesai"
                                                onClick={() => void handleComplete(order.id)}
                                            >
                                                {completingId === order.id
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <CheckCircle2 className="h-4 w-4" />}
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                        disabled={deletingId === order.id}
                                                    >
                                                        {deletingId === order.id
                                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                                            : <Trash2 className="h-4 w-4" />}
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Hapus Pesanan {order.order_number}?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Untuk pesanan dibatalkan/refund atau data uji coba. Tindakan ini
                                                            permanen dan tidak bisa dibatalkan.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => void handleDelete(order.id)}
                                                            className="bg-red-600 hover:bg-red-700"
                                                        >
                                                            Hapus
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
