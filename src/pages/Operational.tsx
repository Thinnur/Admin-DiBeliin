// =============================================================================
// DiBeliin Admin - Operational Page
// =============================================================================
// Store status control, service toggles, and voucher management

import { useState, useEffect } from 'react';
import { Trash2, Plus, Store, Power, Tag, Coffee } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';

import {
    getStoreStatus,
    updateStoreStatus,
    getVouchers,
    createVoucher,
    deleteVoucher,
    getServiceStatus,
    updateServiceStatus,
    type Voucher,
} from '@/services/operationalService';

// -----------------------------------------------------------------------------
// Store Status Section
// -----------------------------------------------------------------------------

interface StoreStatusSectionProps {
    isOpen: boolean;
    isLoading: boolean;
    onToggle: () => void;
}

function StoreStatusSection({ isOpen, isLoading, onToggle }: StoreStatusSectionProps) {
    return (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl shadow-lg">
                        <Store className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Store Status (Global)</CardTitle>
                        <CardDescription>Master switch untuk seluruh toko</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div
                            className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 ${isOpen
                                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30'
                                : 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/30'
                                }`}
                        >
                            <Power className="h-6 w-6 md:h-8 md:w-8 text-white" strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-xl md:text-2xl font-bold text-slate-900">
                                {isOpen ? 'OPEN' : 'CLOSED'}
                            </p>
                            <p className="text-xs md:text-sm text-slate-500">
                                {isOpen
                                    ? 'Toko menerima pesanan'
                                    : 'Toko tidak menerima pesanan'}
                            </p>
                        </div>
                    </div>
                    <Button
                        size="lg"
                        variant={isOpen ? 'destructive' : 'default'}
                        onClick={onToggle}
                        disabled={isLoading}
                        className={`w-full sm:w-auto px-6 ${!isOpen
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700'
                            : ''
                            }`}
                    >
                        {isLoading ? 'Updating...' : isOpen ? 'Close Store' : 'Open Store'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// -----------------------------------------------------------------------------
// Service Status Section (Brand-specific toggles)
// -----------------------------------------------------------------------------

interface ServiceStatusSectionProps {
    isForeOpen: boolean;
    isKenanganOpen: boolean;
    isLoading: boolean;
    onToggleFore: () => void;
    onToggleKenangan: () => void;
}

function ServiceStatusSection({
    isForeOpen,
    isKenanganOpen,
    isLoading,
    onToggleFore,
    onToggleKenangan,
}: ServiceStatusSectionProps) {
    return (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-lg shadow-violet-500/20">
                        <Coffee className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Status Layanan Spesifik</CardTitle>
                        <CardDescription>Kontrol layanan per brand secara terpisah</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Fore Coffee Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${isForeOpen ? 'bg-blue-500' : 'bg-slate-300'}`}>
                            <Coffee className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-900">Layanan Fore Coffee</p>
                            <p className="text-sm text-slate-500">
                                {isForeOpen ? 'Menerima pesanan Fore' : 'Tidak menerima pesanan Fore'}
                            </p>
                        </div>
                    </div>
                    <Switch
                        checked={isForeOpen}
                        onCheckedChange={onToggleFore}
                        disabled={isLoading}
                        className="data-[state=checked]:bg-blue-600"
                    />
                </div>

                {/* Kopi Kenangan Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${isKenanganOpen ? 'bg-amber-500' : 'bg-slate-300'}`}>
                            <Coffee className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-900">Layanan Kopi Kenangan</p>
                            <p className="text-sm text-slate-500">
                                {isKenanganOpen ? 'Menerima pesanan Kenangan' : 'Tidak menerima pesanan Kenangan'}
                            </p>
                        </div>
                    </div>
                    <Switch
                        checked={isKenanganOpen}
                        onCheckedChange={onToggleKenangan}
                        disabled={isLoading}
                        className="data-[state=checked]:bg-amber-600"
                    />
                </div>
            </CardContent>
        </Card>
    );
}

// -----------------------------------------------------------------------------
// Voucher Form
// -----------------------------------------------------------------------------

interface VoucherFormProps {
    onSubmit: (voucher: Partial<Voucher>) => void;
    isLoading: boolean;
}

function VoucherForm({ onSubmit, isLoading }: VoucherFormProps) {
    const [code, setCode] = useState('');
    const [discountAmount, setDiscountAmount] = useState('');
    const [minPurchase, setMinPurchase] = useState('');
    const [maxPurchase, setMaxPurchase] = useState('');
    const [quota, setQuota] = useState('1');
    const [validFor, setValidFor] = useState<'all' | 'fore' | 'kenangan'>('all');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!code.trim()) {
            toast.error('Voucher code is required');
            return;
        }

        if (!discountAmount || Number(discountAmount) <= 0) {
            toast.error('Discount amount must be greater than 0');
            return;
        }

        onSubmit({
            code: code.trim().toUpperCase(),
            discount_amount: Number(discountAmount),
            min_purchase: Number(minPurchase) || 0,
            max_purchase: maxPurchase ? Number(maxPurchase) : null,
            quota: Number(quota) || 1,
            valid_for: validFor,
            is_active: true,
        });

        // Reset form
        setCode('');
        setDiscountAmount('');
        setMinPurchase('');
        setMaxPurchase('');
        setQuota('1');
        setValidFor('all');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="code">Voucher Code</Label>
                    <Input
                        id="code"
                        placeholder="e.g., HEMAT20K"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="uppercase"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="discount">Discount Amount (Rp)</Label>
                    <Input
                        id="discount"
                        type="number"
                        placeholder="e.g., 20000"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="minPurchase">Min Purchase (Rp)</Label>
                    <Input
                        id="minPurchase"
                        type="number"
                        placeholder="e.g., 50000"
                        value={minPurchase}
                        onChange={(e) => setMinPurchase(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="maxPurchase">Max Purchase (Rp, optional)</Label>
                    <Input
                        id="maxPurchase"
                        type="number"
                        placeholder="Leave empty for no limit"
                        value={maxPurchase}
                        onChange={(e) => setMaxPurchase(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="quota">Quota</Label>
                    <Input
                        id="quota"
                        type="number"
                        placeholder="1"
                        value={quota}
                        onChange={(e) => setQuota(e.target.value)}
                        min="1"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="validFor">Valid For</Label>
                    <Select value={validFor} onValueChange={(v) => setValidFor(v as typeof validFor)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Brands</SelectItem>
                            <SelectItem value="fore">Fore Coffee</SelectItem>
                            <SelectItem value="kenangan">Kopi Kenangan</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {isLoading ? 'Adding...' : 'Add Voucher'}
            </Button>
        </form>
    );
}

// -----------------------------------------------------------------------------
// Voucher Table
// -----------------------------------------------------------------------------

interface VoucherTableProps {
    vouchers: Voucher[];
    onDelete: (id: number) => void;
    isDeleting: number | null;
}

function VoucherTable({ vouchers, onDelete, isDeleting }: VoucherTableProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const getBrandBadge = (brand: string) => {
        switch (brand) {
            case 'fore':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Fore</Badge>;
            case 'kenangan':
                return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Kenangan</Badge>;
            default:
                return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">All</Badge>;
        }
    };

    if (vouchers.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500">
                <Tag className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">No vouchers found</p>
                <p className="text-sm">Add a voucher using the form above</p>
            </div>
        );
    }

    return (
        <>
            {/* Desktop: Table */}
            <div className="hidden md:block overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Discount</TableHead>
                            <TableHead>Min Purchase</TableHead>
                            <TableHead>Max Purchase</TableHead>
                            <TableHead>Quota</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {vouchers.map((voucher) => (
                            <TableRow key={voucher.id}>
                                <TableCell className="font-mono font-semibold">{voucher.code}</TableCell>
                                <TableCell className="text-emerald-600 font-medium">
                                    {formatCurrency(voucher.discount_amount)}
                                </TableCell>
                                <TableCell>{formatCurrency(voucher.min_purchase)}</TableCell>
                                <TableCell>
                                    {voucher.max_purchase ? formatCurrency(voucher.max_purchase) : '—'}
                                </TableCell>
                                <TableCell>{voucher.quota}</TableCell>
                                <TableCell>{getBrandBadge(voucher.valid_for)}</TableCell>
                                <TableCell>
                                    {voucher.is_active ? (
                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                            Active
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary">Inactive</Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                        onClick={() => onDelete(voucher.id)}
                                        disabled={isDeleting === voucher.id}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile: Card List */}
            <div className="md:hidden space-y-2">
                {vouchers.map((voucher) => (
                    <div
                        key={voucher.id}
                        className="p-3 rounded-xl border border-slate-100 bg-white"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono font-bold text-sm text-slate-900">{voucher.code}</span>
                                    {getBrandBadge(voucher.valid_for)}
                                    {voucher.is_active ? (
                                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                                    ) : (
                                        <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
                                    )}
                                </div>
                                <p className="text-xs text-slate-500">
                                    Diskon <span className="text-emerald-600 font-semibold">{formatCurrency(voucher.discount_amount)}</span>
                                    {' · '}
                                    Min {formatCurrency(voucher.min_purchase)}
                                    {voucher.max_purchase ? ` · Max ${formatCurrency(voucher.max_purchase)}` : ''}
                                    {' · '}
                                    Quota: {voucher.quota}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                                onClick={() => onDelete(voucher.id)}
                                disabled={isDeleting === voucher.id}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

// -----------------------------------------------------------------------------
// Main Operational Page
// -----------------------------------------------------------------------------

export default function Operational() {
    // Store status state
    const [isStoreOpen, setIsStoreOpen] = useState(true);
    const [isStatusLoading, setIsStatusLoading] = useState(false);

    // Service status state (brand-specific)
    const [isForeOpen, setIsForeOpen] = useState(true);
    const [isKenanganOpen, setIsKenanganOpen] = useState(true);
    const [isServiceLoading, setIsServiceLoading] = useState(false);

    // Voucher state
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [isVouchersLoading, setIsVouchersLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

    // Initial data fetch
    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [status, foreStatus, kenanganStatus, voucherList] = await Promise.all([
                getStoreStatus(),
                getServiceStatus('fore'),
                getServiceStatus('kenangan'),
                getVouchers(),
            ]);
            setIsStoreOpen(status);
            setIsForeOpen(foreStatus);
            setIsKenanganOpen(kenanganStatus);
            setVouchers(voucherList);
        } catch (error) {
            console.error('Error fetching initial data:', error);
            toast.error('Failed to load operational data');
        } finally {
            setIsVouchersLoading(false);
        }
    };

    // Toggle store status (global)
    const handleToggleStore = async () => {
        setIsStatusLoading(true);
        try {
            const newStatus = !isStoreOpen;
            await updateStoreStatus(newStatus);
            setIsStoreOpen(newStatus);
            toast.success(`Store is now ${newStatus ? 'OPEN' : 'CLOSED'}`);
        } catch (error) {
            console.error('Error toggling store:', error);
            toast.error('Failed to update store status');
        } finally {
            setIsStatusLoading(false);
        }
    };

    // Toggle Fore service
    const handleToggleFore = async () => {
        setIsServiceLoading(true);
        try {
            const newStatus = !isForeOpen;
            await updateServiceStatus('fore', newStatus);
            setIsForeOpen(newStatus);
            toast.success(`Layanan Fore ${newStatus ? 'DIBUKA' : 'DITUTUP'}`);
        } catch (error) {
            console.error('Error toggling Fore service:', error);
            toast.error('Gagal mengubah status layanan Fore');
        } finally {
            setIsServiceLoading(false);
        }
    };

    // Toggle Kenangan service
    const handleToggleKenangan = async () => {
        setIsServiceLoading(true);
        try {
            const newStatus = !isKenanganOpen;
            await updateServiceStatus('kenangan', newStatus);
            setIsKenanganOpen(newStatus);
            toast.success(`Layanan Kenangan ${newStatus ? 'DIBUKA' : 'DITUTUP'}`);
        } catch (error) {
            console.error('Error toggling Kenangan service:', error);
            toast.error('Gagal mengubah status layanan Kenangan');
        } finally {
            setIsServiceLoading(false);
        }
    };

    // Create voucher
    const handleCreateVoucher = async (voucherData: Partial<Voucher>) => {
        setIsCreating(true);
        try {
            const newVoucher = await createVoucher(voucherData);
            setVouchers((prev) => [newVoucher, ...prev]);
            toast.success(`Voucher "${newVoucher.code}" created successfully`);
        } catch (error) {
            console.error('Error creating voucher:', error);
            const message = error instanceof Error ? error.message : 'Failed to create voucher';
            toast.error(message);
        } finally {
            setIsCreating(false);
        }
    };

    // Delete voucher
    const handleDeleteVoucher = async (id: number) => {
        setIsDeletingId(id);
        try {
            await deleteVoucher(id);
            setVouchers((prev) => prev.filter((v) => v.id !== id));
            toast.success('Voucher deleted successfully');
        } catch (error) {
            console.error('Error deleting voucher:', error);
            toast.error('Failed to delete voucher');
        } finally {
            setIsDeletingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Store Status (Global) */}
            <StoreStatusSection
                isOpen={isStoreOpen}
                isLoading={isStatusLoading}
                onToggle={handleToggleStore}
            />

            {/* Service Status (Brand-specific) */}
            <ServiceStatusSection
                isForeOpen={isForeOpen}
                isKenanganOpen={isKenanganOpen}
                isLoading={isServiceLoading}
                onToggleFore={handleToggleFore}
                onToggleKenangan={handleToggleKenangan}
            />

            {/* Voucher Management */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl shadow-lg shadow-amber-500/20">
                            <Tag className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Voucher Management</CardTitle>
                            <CardDescription>Create and manage discount vouchers</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Voucher Form */}
                    <VoucherForm onSubmit={handleCreateVoucher} isLoading={isCreating} />

                    {/* Divider */}
                    <div className="border-t border-slate-200" />

                    {/* Voucher List */}
                    {isVouchersLoading ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="animate-pulse">Loading vouchers...</div>
                        </div>
                    ) : (
                        <VoucherTable
                            vouchers={vouchers}
                            onDelete={handleDeleteVoucher}
                            isDeleting={isDeletingId}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
