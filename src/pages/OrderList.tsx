import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator as CalculatorIcon, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { listNewQrisOrders, type QrisOrder } from '@/services/qrisOrderService';

export default function OrderListPage() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<QrisOrder[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setOrders(await listNewQrisOrders());
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat pesanan');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

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
                <CardHeader>
                    <CardTitle>Sudah Dibayar</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">Memuat…</p>
                    ) : orders.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            Belum ada pesanan baru. Order Kenangan/Fore/Tomoro dari web muncul di sini
                            otomatis setelah dibayar.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>No. Pesanan</TableHead>
                                    <TableHead>Waktu Bayar</TableHead>
                                    <TableHead>Nama</TableHead>
                                    <TableHead>Outlet</TableHead>
                                    <TableHead>Item</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((order) => (
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
