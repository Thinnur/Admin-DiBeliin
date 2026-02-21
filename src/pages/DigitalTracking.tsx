// =============================================================================
// DiBeliin Admin - Digital Tracking
// =============================================================================
// Tracking masa aktif langganan produk digital pelanggan

import { useState, useEffect, useMemo } from 'react';
import {
    Plus,
    Pencil,
    Trash2,
    CalendarClock,
    Search,
    AlertTriangle,
    XCircle,
    CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import {
    getDigitalSubscriptions,
    createDigitalSubscription,
    updateDigitalSubscription,
    deleteDigitalSubscription,
    getDigitalProducts,
    type DigitalProduct,
    type DigitalSubscription,
    type SubscriptionStatus,
} from '@/services/digitalService';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const WARNING_DAYS = 3;

type ExpiryState = 'expired' | 'warning' | 'active';

function getExpiryState(endDate: string): ExpiryState {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= WARNING_DAYS) return 'warning';
    return 'active';
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function getDaysRemaining(endDate: string): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// Row & badge styles based on expiry state
const ROW_STYLES: Record<ExpiryState, string> = {
    expired: 'bg-red-50/60 hover:bg-red-50',
    warning: 'bg-amber-50/60 hover:bg-amber-50',
    active: 'hover:bg-slate-50/60',
};

function ExpiryBadge({ endDate, status }: { endDate: string; status: SubscriptionStatus }) {
    if (status === 'cancelled') {
        return <Badge variant="secondary">Dibatalkan</Badge>;
    }

    const state = getExpiryState(endDate);
    const days = getDaysRemaining(endDate);

    if (state === 'expired') {
        return (
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1">
                <XCircle className="h-3 w-3" />
                Kedaluwarsa
            </Badge>
        );
    }
    if (state === 'warning') {
        return (
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 gap-1">
                <AlertTriangle className="h-3 w-3" />
                H-{days}
            </Badge>
        );
    }
    return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 gap-1">
            <CheckCircle className="h-3 w-3" />
            Aktif
        </Badge>
    );
}

// -----------------------------------------------------------------------------
// Subscription Form Dialog
// -----------------------------------------------------------------------------

interface SubFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (sub: Omit<DigitalSubscription, 'id' | 'created_at'>) => void;
    isLoading: boolean;
    editingSub?: DigitalSubscription | null;
    catalogProducts: DigitalProduct[];
}

function SubFormDialog({ open, onOpenChange, onSubmit, isLoading, editingSub, catalogProducts }: SubFormDialogProps) {
    const [customerName, setCustomerName] = useState('');
    const [customerWa, setCustomerWa] = useState('');
    const [productName, setProductName] = useState('');
    const [accountEmail, setAccountEmail] = useState('');
    const [accountPassword, setAccountPassword] = useState('');
    const [profileName, setProfileName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [status, setStatus] = useState<SubscriptionStatus>('active');

    useEffect(() => {
        if (editingSub) {
            setCustomerName(editingSub.customer_name);
            setCustomerWa(editingSub.customer_wa);
            setProductName(editingSub.product_name);
            setAccountEmail(editingSub.account_email);
            setAccountPassword(editingSub.account_password);
            setProfileName(editingSub.profile_name || '');
            setStartDate(editingSub.start_date);
            setEndDate(editingSub.end_date);
            setStatus(editingSub.status);
        } else {
            setCustomerName('');
            setCustomerWa('');
            setProductName('');
            setAccountEmail('');
            setAccountPassword('');
            setProfileName('');
            setStartDate('');
            setEndDate('');
            setStatus('active');
        }
    }, [editingSub, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!customerName.trim()) return toast.error('Nama pelanggan wajib diisi');
        if (!customerWa.trim()) return toast.error('Nomor WA wajib diisi');
        if (!productName.trim()) return toast.error('Nama produk wajib diisi');
        if (!accountEmail.trim()) return toast.error('Email akun wajib diisi');
        if (!accountPassword.trim()) return toast.error('Password akun wajib diisi');
        if (!startDate) return toast.error('Tanggal mulai wajib diisi');
        if (!endDate) return toast.error('Tanggal habis wajib diisi');

        onSubmit({
            customer_name: customerName.trim(),
            customer_wa: customerWa.trim(),
            product_name: productName.trim(),
            account_email: accountEmail.trim(),
            account_password: accountPassword.trim(),
            profile_name: profileName.trim() || null,
            start_date: startDate,
            end_date: endDate,
            status,
        });
    };

    const isEditing = !!editingSub;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarClock className="h-5 w-5 text-amber-500" />
                            {isEditing ? 'Edit Langganan' : 'Catat Langganan Baru'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? 'Perbarui data langganan pelanggan.'
                                : 'Catat data langganan produk digital pelanggan.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Info Pelanggan */}
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Info Pelanggan
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="customer_name">Nama Pelanggan</Label>
                                <Input
                                    id="customer_name"
                                    placeholder="cth. Budi Santoso"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="customer_wa">No. WhatsApp</Label>
                                <Input
                                    id="customer_wa"
                                    placeholder="cth. 081234567890"
                                    value={customerWa}
                                    onChange={(e) => setCustomerWa(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Info Produk */}
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Info Produk
                        </p>
                        <div className="space-y-2">
                            <Label htmlFor="product_name">Nama Produk</Label>
                            <Select
                                value={productName}
                                onValueChange={setProductName}
                            >
                                <SelectTrigger id="product_name">
                                    <SelectValue placeholder="Pilih produk dari katalog..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {catalogProducts.length === 0 ? (
                                        <SelectItem value="_empty" disabled>
                                            Belum ada produk di katalog
                                        </SelectItem>
                                    ) : (
                                        catalogProducts.map((product) => (
                                            <SelectItem key={product.id} value={product.name}>
                                                {product.name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Info Akun */}
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Info Akun
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="account_email">Email Akun</Label>
                                <Input
                                    id="account_email"
                                    placeholder="email@gmail.com"
                                    value={accountEmail}
                                    onChange={(e) => setAccountEmail(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="account_password">Password</Label>
                                <Input
                                    id="account_password"
                                    placeholder="password akun"
                                    value={accountPassword}
                                    onChange={(e) => setAccountPassword(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="profile_name">Nama Profil (opsional)</Label>
                            <Input
                                id="profile_name"
                                placeholder="cth. Profil 1 / Budi"
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                            />
                        </div>

                        {/* Masa Aktif */}
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Masa Aktif
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="start_date">Tanggal Mulai</Label>
                                <Input
                                    id="start_date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end_date">Tanggal Habis</Label>
                                <Input
                                    id="end_date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                                value={status}
                                onValueChange={(v) => setStatus(v as SubscriptionStatus)}
                            >
                                <SelectTrigger id="status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Aktif</SelectItem>
                                    <SelectItem value="expired">Kedaluwarsa</SelectItem>
                                    <SelectItem value="cancelled">Dibatalkan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading
                                ? isEditing
                                    ? 'Menyimpan...'
                                    : 'Mencatat...'
                                : isEditing
                                    ? 'Simpan'
                                    : 'Catat Langganan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// -----------------------------------------------------------------------------
// Main Page
// -----------------------------------------------------------------------------

export default function DigitalTracking() {
    const [subscriptions, setSubscriptions] = useState<DigitalSubscription[]>([]);
    const [catalogProducts, setCatalogProducts] = useState<DigitalProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingSub, setEditingSub] = useState<DigitalSubscription | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    const fetchSubscriptions = async () => {
        try {
            const [subscriptionData, productData] = await Promise.all([
                getDigitalSubscriptions(),
                getDigitalProducts(),
            ]);
            setSubscriptions(subscriptionData);
            setCatalogProducts(productData);
        } catch (error) {
            console.error(error);
            toast.error('Gagal memuat data');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredSubs = useMemo(() => {
        return subscriptions.filter((s) => {
            const query = searchQuery.toLowerCase();
            const matchesSearch =
                !query ||
                s.customer_name.toLowerCase().includes(query) ||
                s.product_name.toLowerCase().includes(query) ||
                s.customer_wa.includes(query);

            if (statusFilter === 'all') return matchesSearch;
            if (statusFilter === 'warning') {
                return matchesSearch && getExpiryState(s.end_date) === 'warning';
            }
            if (statusFilter === 'expired') {
                return (
                    matchesSearch &&
                    (s.status === 'expired' || getExpiryState(s.end_date) === 'expired')
                );
            }
            return matchesSearch && s.status === statusFilter;
        });
    }, [subscriptions, searchQuery, statusFilter]);

    const stats = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return {
            total: subscriptions.length,
            active: subscriptions.filter(
                (s) => s.status === 'active' && getExpiryState(s.end_date) === 'active'
            ).length,
            warning: subscriptions.filter(
                (s) => s.status === 'active' && getExpiryState(s.end_date) === 'warning'
            ).length,
            expired: subscriptions.filter(
                (s) => s.status === 'expired' || getExpiryState(s.end_date) === 'expired'
            ).length,
        };
    }, [subscriptions]);

    const handleOpenAdd = () => {
        setEditingSub(null);
        setDialogOpen(true);
    };

    const handleEdit = (sub: DigitalSubscription) => {
        setEditingSub(sub);
        setDialogOpen(true);
    };

    const handleSubmit = async (subData: Omit<DigitalSubscription, 'id' | 'created_at'>) => {
        setIsSubmitting(true);
        try {
            if (editingSub) {
                const updated = await updateDigitalSubscription(editingSub.id, subData);
                setSubscriptions((prev) =>
                    prev.map((s) => (s.id === editingSub.id ? updated : s))
                );
                toast.success(`Langganan "${updated.customer_name}" berhasil diperbarui`);
            } else {
                const newSub = await createDigitalSubscription(subData);
                setSubscriptions((prev) => [...prev, newSub]);
                toast.success(`Langganan "${newSub.customer_name}" berhasil dicatat`);
            }
            setDialogOpen(false);
            setEditingSub(null);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Gagal menyimpan langganan';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        const sub = subscriptions.find((s) => s.id === id);
        if (!confirm(`Hapus langganan "${sub?.customer_name}"?`)) return;
        setIsDeletingId(id);
        try {
            await deleteDigitalSubscription(id);
            setSubscriptions((prev) => prev.filter((s) => s.id !== id));
            toast.success('Langganan berhasil dihapus');
        } catch (error) {
            toast.error('Gagal menghapus langganan');
        } finally {
            setIsDeletingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                <Card className="border-0 shadow-md bg-gradient-to-br from-white to-slate-50">
                    <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-6">
                        <p className="text-xs md:text-sm text-slate-500">Total Langganan</p>
                        <p className="text-xl md:text-2xl font-bold text-slate-900">{stats.total}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-white">
                    <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-6">
                        <p className="text-xs md:text-sm text-emerald-600">Aktif</p>
                        <p className="text-xl md:text-2xl font-bold text-emerald-700">{stats.active}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-white">
                    <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-6">
                        <p className="text-xs md:text-sm text-amber-600">Hampir Habis</p>
                        <p className="text-xl md:text-2xl font-bold text-amber-700">{stats.warning}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-white">
                    <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-6">
                        <p className="text-xs md:text-sm text-red-600">Kedaluwarsa</p>
                        <p className="text-xl md:text-2xl font-bold text-red-700">{stats.expired}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                                <CalendarClock className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Tracking Langganan</CardTitle>
                                <CardDescription>
                                    Pantau masa aktif langganan pelanggan
                                </CardDescription>
                            </div>
                        </div>
                        <Button onClick={handleOpenAdd}>
                            <Plus className="h-4 w-4 mr-2" />
                            Catat Langganan Baru
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari nama pelanggan, produk, atau WA..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-48">
                                <SelectValue placeholder="Semua Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                <SelectItem value="active">Aktif</SelectItem>
                                <SelectItem value="warning">Hampir Habis (H-3)</SelectItem>
                                <SelectItem value="expired">Kedaluwarsa</SelectItem>
                                <SelectItem value="cancelled">Dibatalkan</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-red-200 inline-block" />
                            Kedaluwarsa
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-amber-200 inline-block" />
                            H-3 (warning)
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-white border border-slate-200 inline-block" />
                            Aktif normal
                        </span>
                    </div>

                    {/* Table */}
                    {isLoading ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="animate-pulse">Memuat data...</div>
                        </div>
                    ) : filteredSubs.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <CalendarClock className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                            <p className="font-medium">Belum ada data langganan</p>
                            <p className="text-sm">Klik "Catat Langganan Baru" untuk memulai</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Pelanggan</TableHead>
                                            <TableHead>WA</TableHead>
                                            <TableHead>Produk</TableHead>
                                            <TableHead>Email Akun</TableHead>
                                            <TableHead>Profil</TableHead>
                                            <TableHead>Tgl Mulai</TableHead>
                                            <TableHead>Tgl Habis</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="w-[80px]">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredSubs.map((sub) => {
                                            const expiryState = getExpiryState(sub.end_date);
                                            return (
                                                <TableRow
                                                    key={sub.id}
                                                    className={cn(
                                                        'transition-colors',
                                                        sub.status !== 'cancelled' && ROW_STYLES[expiryState]
                                                    )}
                                                >
                                                    <TableCell className="font-medium">
                                                        {sub.customer_name}
                                                    </TableCell>
                                                    <TableCell className="text-slate-600">
                                                        {sub.customer_wa}
                                                    </TableCell>
                                                    <TableCell className="text-slate-700">
                                                        {sub.product_name}
                                                    </TableCell>
                                                    <TableCell className="text-slate-600 text-xs">
                                                        {sub.account_email}
                                                    </TableCell>
                                                    <TableCell className="text-slate-500">
                                                        {sub.profile_name || '—'}
                                                    </TableCell>
                                                    <TableCell className="text-slate-500 text-sm">
                                                        {formatDate(sub.start_date)}
                                                    </TableCell>
                                                    <TableCell className="text-sm font-medium">
                                                        {formatDate(sub.end_date)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <ExpiryBadge
                                                            endDate={sub.end_date}
                                                            status={sub.status}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                                                onClick={() => handleEdit(sub)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                                onClick={() => handleDelete(sub.id)}
                                                                disabled={isDeletingId === sub.id}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden space-y-2">
                                {filteredSubs.map((sub) => {
                                    const expiryState = getExpiryState(sub.end_date);
                                    return (
                                        <div
                                            key={sub.id}
                                            className={cn(
                                                'p-3 rounded-xl border bg-white',
                                                expiryState === 'expired' && sub.status !== 'cancelled'
                                                    ? 'border-red-200 bg-red-50/50'
                                                    : expiryState === 'warning' &&
                                                        sub.status !== 'cancelled'
                                                        ? 'border-amber-200 bg-amber-50/50'
                                                        : 'border-slate-100'
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-sm text-slate-900">
                                                            {sub.customer_name}
                                                        </span>
                                                        <ExpiryBadge
                                                            endDate={sub.end_date}
                                                            status={sub.status}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-slate-600 truncate">
                                                        {sub.product_name}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {sub.customer_wa} · {sub.account_email}
                                                    </p>
                                                    {sub.profile_name && (
                                                        <p className="text-xs text-slate-400">
                                                            Profil: {sub.profile_name}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        {formatDate(sub.start_date)} →{' '}
                                                        {formatDate(sub.end_date)}
                                                    </p>
                                                </div>
                                                <div className="flex gap-0.5 shrink-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                                        onClick={() => handleEdit(sub)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                        onClick={() => handleDelete(sub.id)}
                                                        disabled={isDeletingId === sub.id}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {!isLoading && (
                        <p className="text-sm text-slate-500 text-center">
                            Menampilkan {filteredSubs.length} dari {subscriptions.length} langganan
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Dialog */}
            <SubFormDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) setEditingSub(null);
                }}
                onSubmit={handleSubmit}
                isLoading={isSubmitting}
                editingSub={editingSub}
                catalogProducts={catalogProducts}
            />
        </div>
    );
}
