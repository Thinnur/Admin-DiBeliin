// =============================================================================
// DiBeliin Admin - Digital Providers Management
// =============================================================================
// CRUD untuk daftar provider digital (Netflix, Spotify, dll.) beserta logo

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import {
    getProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    type DigitalProvider,
} from '@/services/digitalService';

// -----------------------------------------------------------------------------
// Provider Form Dialog
// -----------------------------------------------------------------------------

interface ProviderFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: Omit<DigitalProvider, 'id' | 'created_at'>) => void;
    isLoading: boolean;
    editingProvider?: DigitalProvider | null;
}

function ProviderFormDialog({
    open,
    onOpenChange,
    onSubmit,
    isLoading,
    editingProvider,
}: ProviderFormDialogProps) {
    const [name, setName] = useState('');
    const [logoUrl, setLogoUrl] = useState('');

    useEffect(() => {
        if (editingProvider) {
            setName(editingProvider.name);
            setLogoUrl(editingProvider.logo_url || '');
        } else {
            setName('');
            setLogoUrl('');
        }
    }, [editingProvider, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return toast.error('Nama provider wajib diisi');
        onSubmit({
            name: name.trim(),
            logo_url: logoUrl.trim() || null,
        });
    };

    const isEditing = !!editingProvider;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[440px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Layers className="h-5 w-5 text-violet-500" />
                            {isEditing ? 'Edit Provider' : 'Tambah Provider'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? 'Perbarui informasi provider digital.'
                                : 'Tambahkan provider digital baru (cth. Netflix, Spotify).'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Preview Logo */}
                        {logoUrl && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                <img
                                    src={logoUrl}
                                    alt="preview logo"
                                    className="w-10 h-10 object-contain rounded"
                                    onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                                <span className="text-xs text-slate-500">Preview logo</span>
                            </div>
                        )}

                        {/* Nama Provider */}
                        <div className="space-y-2">
                            <Label htmlFor="prov-name">Nama Provider</Label>
                            <Input
                                id="prov-name"
                                placeholder="cth. Netflix, Spotify, Disney+"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {/* URL Logo */}
                        <div className="space-y-2">
                            <Label htmlFor="prov-logo">URL Logo</Label>
                            <Input
                                id="prov-logo"
                                placeholder="Masukkan link gambar logo dari internet"
                                value={logoUrl}
                                onChange={(e) => setLogoUrl(e.target.value)}
                            />
                            <p className="text-xs text-slate-400">
                                Tempel URL gambar logo (PNG/SVG/WebP). Contoh dari Google Images, Wikipedia, dll.
                            </p>
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
                                ? isEditing ? 'Menyimpan...' : 'Menambahkan...'
                                : isEditing ? 'Simpan' : 'Tambah Provider'}
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

export default function DigitalProviders() {
    const [providers, setProviders] = useState<DigitalProvider[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<DigitalProvider | null>(null);

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        try {
            const data = await getProviders();
            setProviders(data);
        } catch (error) {
            console.error(error);
            toast.error('Gagal memuat data provider');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setEditingProvider(null);
        setDialogOpen(true);
    };

    const handleEdit = (provider: DigitalProvider) => {
        setEditingProvider(provider);
        setDialogOpen(true);
    };

    const handleSubmit = async (providerData: Omit<DigitalProvider, 'id' | 'created_at'>) => {
        setIsSubmitting(true);
        try {
            if (editingProvider) {
                const updated = await updateProvider(editingProvider.id, providerData);
                setProviders((prev) => prev.map((p) => (p.id === editingProvider.id ? updated : p)));
                toast.success(`Provider "${updated.name}" berhasil diperbarui`);
            } else {
                const newProvider = await createProvider(providerData);
                setProviders((prev) => [...prev, newProvider].sort((a, b) => a.name.localeCompare(b.name)));
                toast.success(`Provider "${newProvider.name}" berhasil ditambahkan`);
            }
            setDialogOpen(false);
            setEditingProvider(null);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Gagal menyimpan provider';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        const provider = providers.find((p) => p.id === id);
        if (!confirm(`Hapus provider "${provider?.name}"? Produk yang terhubung tidak akan terhapus.`)) return;
        setIsDeletingId(id);
        try {
            await deleteProvider(id);
            setProviders((prev) => prev.filter((p) => p.id !== id));
            toast.success(`Provider "${provider?.name}" berhasil dihapus`);
        } catch (error) {
            toast.error('Gagal menghapus provider');
        } finally {
            setIsDeletingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Main Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-lg shadow-violet-500/20">
                                <Layers className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Kelola Provider Digital</CardTitle>
                                <CardDescription>
                                    {providers.length} provider terdaftar · Data digunakan di Katalog Digital
                                </CardDescription>
                            </div>
                        </div>
                        <Button onClick={handleOpenAdd}>
                            <Plus className="h-4 w-4 mr-2" />
                            Tambah Provider
                        </Button>
                    </div>
                </CardHeader>

                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="animate-pulse">Memuat data...</div>
                        </div>
                    ) : providers.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Layers className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                            <p className="font-medium">Belum ada provider</p>
                            <p className="text-sm">Klik "Tambah Provider" untuk memulai</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-16">Logo</TableHead>
                                            <TableHead>Nama Provider</TableHead>
                                            <TableHead>URL Logo</TableHead>
                                            <TableHead className="w-[100px]">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {providers.map((provider) => (
                                            <TableRow key={provider.id}>
                                                <TableCell>
                                                    {provider.logo_url ? (
                                                        <img
                                                            src={provider.logo_url}
                                                            alt={provider.name}
                                                            className="w-8 h-8 object-contain rounded"
                                                            onError={(e) => {
                                                                (e.currentTarget as HTMLImageElement).style.opacity = '0.2';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                                                            <Layers className="h-4 w-4 text-slate-400" />
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-semibold text-slate-800">
                                                    {provider.name}
                                                </TableCell>
                                                <TableCell className="text-slate-400 text-xs max-w-[240px] truncate">
                                                    {provider.logo_url || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                                            onClick={() => handleEdit(provider)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                            onClick={() => handleDelete(provider.id)}
                                                            disabled={isDeletingId === provider.id}
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
                                {providers.map((provider) => (
                                    <div
                                        key={provider.id}
                                        className="p-3 rounded-xl border border-slate-100 bg-white flex items-center gap-3"
                                    >
                                        {provider.logo_url ? (
                                            <img
                                                src={provider.logo_url}
                                                alt={provider.name}
                                                className="w-10 h-10 object-contain rounded shrink-0"
                                                onError={(e) => {
                                                    (e.currentTarget as HTMLImageElement).style.opacity = '0.2';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center shrink-0">
                                                <Layers className="h-5 w-5 text-slate-400" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-slate-900">{provider.name}</p>
                                            {provider.logo_url && (
                                                <p className="text-xs text-slate-400 truncate">{provider.logo_url}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-0.5 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                                onClick={() => handleEdit(provider)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                onClick={() => handleDelete(provider.id)}
                                                disabled={isDeletingId === provider.id}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Dialog */}
            <ProviderFormDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) setEditingProvider(null);
                }}
                onSubmit={handleSubmit}
                isLoading={isSubmitting}
                editingProvider={editingProvider}
            />
        </div>
    );
}
