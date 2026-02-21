// =============================================================================
// DiBeliin Admin - Digital Products Management
// =============================================================================
// CRUD untuk katalog produk digital (Netflix, Spotify, YouTube, dll.)

import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, MonitorPlay, Search } from 'lucide-react';
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

import {
    getDigitalProducts,
    createDigitalProduct,
    updateDigitalProduct,
    deleteDigitalProduct,
    getProviders,
    type DigitalProduct,
    type DigitalProvider,
} from '@/services/digitalService';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

function formatRupiah(value: number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(value);
}

// -----------------------------------------------------------------------------
// Product Form Dialog
// -----------------------------------------------------------------------------

interface ProductFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (product: Omit<DigitalProduct, 'id' | 'created_at'>) => void;
    isLoading: boolean;
    editingProduct?: DigitalProduct | null;
    providers: DigitalProvider[];
}

function ProductFormDialog({
    open,
    onOpenChange,
    onSubmit,
    isLoading,
    editingProduct,
    providers,
}: ProductFormDialogProps) {
    const [name, setName] = useState('');
    const [provider, setProvider] = useState<string>('');
    const [price, setPrice] = useState('');
    const [duration, setDuration] = useState('');
    const [description, setDescription] = useState('');
    const [isAvailable, setIsAvailable] = useState(true);

    useEffect(() => {
        if (editingProduct) {
            setName(editingProduct.name);
            setProvider(editingProduct.provider);
            setPrice(String(editingProduct.price));
            setDuration(editingProduct.duration);
            setDescription(editingProduct.description || '');
            setIsAvailable(editingProduct.is_available);
        } else {
            setName('');
            setProvider('');
            setPrice('');
            setDuration('');
            setDescription('');
            setIsAvailable(true);
        }
    }, [editingProduct, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) return toast.error('Nama produk wajib diisi');
        if (!provider.trim()) return toast.error('Provider wajib dipilih');
        if (!price || isNaN(Number(price)) || Number(price) < 0) return toast.error('Harga tidak valid');
        if (!duration.trim()) return toast.error('Durasi wajib diisi');

        onSubmit({
            name: name.trim(),
            provider,
            price: Number(price),
            duration: duration.trim(),
            description: description.trim() || null,
            is_available: isAvailable,
        });
    };

    const isEditing = !!editingProduct;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MonitorPlay className="h-5 w-5 text-amber-500" />
                            {isEditing ? 'Edit Produk Digital' : 'Tambah Produk Digital'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? 'Perbarui informasi produk digital.'
                                : 'Tambahkan produk digital baru ke katalog.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Nama Produk */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Produk</Label>
                            <Input
                                id="name"
                                placeholder="cth. Netflix Premium 1 Bulan"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {/* Provider */}
                        <div className="space-y-2">
                            <Label htmlFor="provider">Provider</Label>
                            <Select
                                value={provider}
                                onValueChange={(v) => setProvider(v)}
                            >
                                <SelectTrigger id="provider">
                                    <SelectValue placeholder="Pilih provider..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {providers.length === 0 ? (
                                        <SelectItem value="_empty" disabled>
                                            Belum ada provider — tambahkan di Kelola Provider
                                        </SelectItem>
                                    ) : (
                                        providers.map((p) => (
                                            <SelectItem key={p.id} value={p.name}>
                                                <span className="flex items-center gap-2">
                                                    {p.logo_url && (
                                                        <img
                                                            src={p.logo_url}
                                                            alt={p.name}
                                                            className="w-4 h-4 object-contain"
                                                        />
                                                    )}
                                                    {p.name}
                                                </span>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Harga & Durasi */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="price">Harga (Rp)</Label>
                                <Input
                                    id="price"
                                    type="number"
                                    placeholder="cth. 60000"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    min={0}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="duration">Durasi</Label>
                                <Input
                                    id="duration"
                                    placeholder="cth. 1 Bulan"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Deskripsi */}
                        <div className="space-y-2">
                            <Label htmlFor="description">Deskripsi (opsional)</Label>
                            <Input
                                id="description"
                                placeholder="cth. Sharing 2 profil"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        {/* Status Aktif */}
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                            <input
                                type="checkbox"
                                id="is_available"
                                checked={isAvailable}
                                onChange={(e) => setIsAvailable(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                            />
                            <div>
                                <Label htmlFor="is_available" className="cursor-pointer">
                                    Produk Aktif
                                </Label>
                                <p className="text-xs text-slate-500">
                                    Produk tersedia untuk dijual
                                </p>
                            </div>
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
                                    : 'Menambahkan...'
                                : isEditing
                                    ? 'Simpan'
                                    : 'Tambah Produk'}
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

export default function DigitalProducts() {
    const [products, setProducts] = useState<DigitalProduct[]>([]);
    const [providers, setProviders] = useState<DigitalProvider[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<DigitalProduct | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [providerFilter, setProviderFilter] = useState<string>('all');

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const [productData, providerData] = await Promise.all([
                getDigitalProducts(),
                getProviders(),
            ]);
            setProducts(productData);
            setProviders(providerData);
        } catch (error) {
            console.error(error);
            toast.error('Gagal memuat data');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            const matchesSearch =
                !searchQuery.trim() ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.provider.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesProvider = providerFilter === 'all' || p.provider === providerFilter;
            return matchesSearch && matchesProvider;
        });
    }, [products, searchQuery, providerFilter]);

    const stats = useMemo(
        () => ({
            total: products.length,
            active: products.filter((p) => p.is_available).length,
        }),
        [products]
    );

    const handleOpenAdd = () => {
        setEditingProduct(null);
        setDialogOpen(true);
    };

    const handleEdit = (product: DigitalProduct) => {
        setEditingProduct(product);
        setDialogOpen(true);
    };

    const handleSubmit = async (productData: Omit<DigitalProduct, 'id' | 'created_at'>) => {
        setIsSubmitting(true);
        try {
            if (editingProduct) {
                const updated = await updateDigitalProduct(editingProduct.id, productData);
                setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? updated : p)));
                toast.success(`Produk "${updated.name}" berhasil diperbarui`);
            } else {
                const newProduct = await createDigitalProduct(productData);
                setProducts((prev) => [...prev, newProduct]);
                toast.success(`Produk "${newProduct.name}" berhasil ditambahkan`);
            }
            setDialogOpen(false);
            setEditingProduct(null);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Gagal menyimpan produk';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        const product = products.find((p) => p.id === id);
        if (!confirm(`Hapus produk "${product?.name}"?`)) return;
        setIsDeletingId(id);
        try {
            await deleteDigitalProduct(id);
            setProducts((prev) => prev.filter((p) => p.id !== id));
            toast.success(`Produk "${product?.name}" berhasil dihapus`);
        } catch (error) {
            toast.error('Gagal menghapus produk');
        } finally {
            setIsDeletingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 md:gap-4">
                <Card className="border-0 shadow-md bg-gradient-to-br from-white to-slate-50">
                    <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-6">
                        <p className="text-xs md:text-sm text-slate-500">Total Produk</p>
                        <p className="text-xl md:text-2xl font-bold text-slate-900">{stats.total}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-white">
                    <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-6">
                        <p className="text-xs md:text-sm text-emerald-600">Aktif</p>
                        <p className="text-xl md:text-2xl font-bold text-emerald-700">{stats.active}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-lg shadow-violet-500/20">
                                <MonitorPlay className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Katalog Produk Digital</CardTitle>
                                <CardDescription>Netflix, Spotify, YouTube, dan lainnya</CardDescription>
                            </div>
                        </div>
                        <Button onClick={handleOpenAdd}>
                            <Plus className="h-4 w-4 mr-2" />
                            Tambah Produk
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari produk..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={providerFilter} onValueChange={setProviderFilter}>
                            <SelectTrigger className="w-full sm:w-44">
                                <SelectValue placeholder="Semua Provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Provider</SelectItem>
                                {providers.map((p) => (
                                    <SelectItem key={p.id} value={p.name}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Table */}
                    {isLoading ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="animate-pulse">Memuat data...</div>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <MonitorPlay className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                            <p className="font-medium">Belum ada produk digital</p>
                            <p className="text-sm">Klik "Tambah Produk" untuk memulai</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nama Produk</TableHead>
                                            <TableHead>Provider</TableHead>
                                            <TableHead>Harga</TableHead>
                                            <TableHead>Durasi</TableHead>
                                            <TableHead>Deskripsi</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="w-[100px]">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProducts.map((product) => (
                                            <TableRow key={product.id}>
                                                <TableCell className="font-medium">
                                                    {product.name}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5">
                                                        {(() => {
                                                            const prov = providers.find((p) => p.name === product.provider);
                                                            return prov?.logo_url ? (
                                                                <img
                                                                    src={prov.logo_url}
                                                                    alt={prov.name}
                                                                    className="w-4 h-4 object-contain"
                                                                />
                                                            ) : null;
                                                        })()}
                                                        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                                                            {product.provider}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-semibold text-slate-700">
                                                    {formatRupiah(product.price)}
                                                </TableCell>
                                                <TableCell className="text-slate-600">
                                                    {product.duration}
                                                </TableCell>
                                                <TableCell className="text-slate-500 max-w-[200px] truncate">
                                                    {product.description || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    {product.is_available ? (
                                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                                            Aktif
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary">Non-aktif</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                                            onClick={() => handleEdit(product)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                            onClick={() => handleDelete(product.id)}
                                                            disabled={isDeletingId === product.id}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden space-y-2">
                                {filteredProducts.map((product) => (
                                    <div
                                        key={product.id}
                                        className="p-3 rounded-xl border border-slate-100 bg-white"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-sm text-slate-900 truncate">
                                                        {product.name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                                    {(() => {
                                                        const prov = providers.find((p) => p.name === product.provider);
                                                        return prov?.logo_url ? (
                                                            <img
                                                                src={prov.logo_url}
                                                                alt={prov.name}
                                                                className="w-4 h-4 object-contain"
                                                            />
                                                        ) : null;
                                                    })()}
                                                    <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-[10px] px-1.5 py-0">
                                                        {product.provider}
                                                    </Badge>
                                                    <span className="text-xs font-semibold text-slate-700">
                                                        {formatRupiah(product.price)}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        · {product.duration}
                                                    </span>
                                                </div>
                                                {product.description && (
                                                    <p className="text-xs text-slate-400 mt-1 truncate">
                                                        {product.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex gap-0.5 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                                    onClick={() => handleEdit(product)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                    onClick={() => handleDelete(product.id)}
                                                    disabled={isDeletingId === product.id}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {!isLoading && (
                        <p className="text-sm text-slate-500 text-center">
                            Menampilkan {filteredProducts.length} dari {products.length} produk
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Dialog */}
            <ProductFormDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) setEditingProduct(null);
                }}
                onSubmit={handleSubmit}
                isLoading={isSubmitting}
                editingProduct={editingProduct}
                providers={providers}
            />
        </div>
    );
}
