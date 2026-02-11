// =============================================================================
// DiBeliin Admin - Outlet Management Page
// =============================================================================
// Full CRUD with Edit, Brand Tabs, and City Filter

import { useState, useEffect, useMemo } from 'react';
import { Trash2, Plus, MapPin, Search, Building2, Pencil } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
    getOutlets,
    createOutlet,
    updateOutlet,
    deleteOutlet,
    type Outlet,
} from '@/services/outletService';

// -----------------------------------------------------------------------------
// Outlet Form Dialog (Add/Edit)
// -----------------------------------------------------------------------------

interface OutletFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (outlet: Omit<Outlet, 'id'>) => void;
    isLoading: boolean;
    editingOutlet?: Outlet | null;
}

function OutletFormDialog({
    open,
    onOpenChange,
    onSubmit,
    isLoading,
    editingOutlet
}: OutletFormDialogProps) {
    const [name, setName] = useState('');
    const [brand, setBrand] = useState<'fore' | 'kenangan'>('fore');
    const [city, setCity] = useState('Jakarta');
    const [isPremium, setIsPremium] = useState(false);

    // Pre-fill form when editing
    useEffect(() => {
        if (editingOutlet) {
            setName(editingOutlet.name);
            setBrand(editingOutlet.brand);
            setCity(editingOutlet.city || 'Jakarta');
            setIsPremium(editingOutlet.is_premium);
        } else {
            // Reset form for new outlet
            setName('');
            setBrand('fore');
            setCity('Jakarta');
            setIsPremium(false);
        }
    }, [editingOutlet, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error('Outlet name is required');
            return;
        }

        if (!city.trim()) {
            toast.error('City is required');
            return;
        }

        onSubmit({
            name: name.trim(),
            brand,
            city: city.trim(),
            is_premium: isPremium,
            is_active: true,
        });
    };

    const isEditing = !!editingOutlet;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-amber-500" />
                            {isEditing ? 'Edit Outlet' : 'Add New Outlet'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? 'Update outlet information below.'
                                : 'Add a new outlet to the system. Premium outlets have special pricing.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Outlet Name</Label>
                            <Input
                                id="name"
                                placeholder="e.g., Grand Indonesia"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="brand">Brand</Label>
                            <Select value={brand} onValueChange={(v) => setBrand(v as typeof brand)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fore">Fore Coffee</SelectItem>
                                    <SelectItem value="kenangan">Kopi Kenangan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="city">Kota / Daerah</Label>
                            <Input
                                id="city"
                                placeholder="e.g., Jakarta"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                            <input
                                type="checkbox"
                                id="premium"
                                checked={isPremium}
                                onChange={(e) => setIsPremium(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                            />
                            <div>
                                <Label htmlFor="premium" className="cursor-pointer">
                                    Premium Outlet
                                </Label>
                                <p className="text-xs text-slate-500">
                                    Premium outlets have higher base pricing (Kopi Kenangan)
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
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading
                                ? (isEditing ? 'Saving...' : 'Adding...')
                                : (isEditing ? 'Simpan' : 'Add Outlet')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// -----------------------------------------------------------------------------
// Outlet Table
// -----------------------------------------------------------------------------

interface OutletTableProps {
    outlets: Outlet[];
    onEdit: (outlet: Outlet) => void;
    onDelete: (id: number) => void;
    isDeleting: number | null;
}

function OutletTable({ outlets, onEdit, onDelete, isDeleting }: OutletTableProps) {
    const getBrandBadge = (brand: string) => {
        switch (brand) {
            case 'fore':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Fore</Badge>;
            case 'kenangan':
                return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Kenangan</Badge>;
            default:
                return <Badge variant="secondary">{brand}</Badge>;
        }
    };

    if (outlets.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500">
                <MapPin className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">No outlets found</p>
                <p className="text-sm">Add an outlet or adjust your filters</p>
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
                            <TableHead>Name</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead>City</TableHead>
                            <TableHead>Premium</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {outlets.map((outlet) => (
                            <TableRow key={outlet.id}>
                                <TableCell className="font-medium">{outlet.name}</TableCell>
                                <TableCell>{getBrandBadge(outlet.brand)}</TableCell>
                                <TableCell className="text-slate-600">{outlet.city || '—'}</TableCell>
                                <TableCell>
                                    {outlet.is_premium ? (
                                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                                            Premium
                                        </Badge>
                                    ) : (
                                        <span className="text-slate-400">—</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {outlet.is_active ? (
                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                            Active
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary">Inactive</Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                            onClick={() => onEdit(outlet)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                            onClick={() => onDelete(outlet.id)}
                                            disabled={isDeleting === outlet.id}
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

            {/* Mobile: Card List */}
            <div className="md:hidden space-y-2">
                {outlets.map((outlet) => (
                    <div
                        key={outlet.id}
                        className="p-3 rounded-xl border border-slate-100 bg-white"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-sm text-slate-900 truncate">{outlet.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {getBrandBadge(outlet.brand)}
                                    {outlet.city && (
                                        <span className="text-[10px] text-slate-500">{outlet.city}</span>
                                    )}
                                    {outlet.is_premium && (
                                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px] px-1.5 py-0">
                                            Premium
                                        </Badge>
                                    )}
                                    {outlet.is_active ? (
                                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                                    ) : (
                                        <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-0.5 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                    onClick={() => onEdit(outlet)}
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                    onClick={() => onDelete(outlet.id)}
                                    disabled={isDeleting === outlet.id}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

// -----------------------------------------------------------------------------
// Main Outlet Management Page
// -----------------------------------------------------------------------------

export default function OutletManagement() {
    // State
    const [outlets, setOutlets] = useState<Outlet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [brandFilter, setBrandFilter] = useState<'all' | 'fore' | 'kenangan'>('all');
    const [cityFilter, setCityFilter] = useState<string>('all');

    // Initial data fetch
    useEffect(() => {
        fetchOutlets();
    }, []);

    const fetchOutlets = async () => {
        try {
            const data = await getOutlets();
            setOutlets(data);
        } catch (error) {
            console.error('Error fetching outlets:', error);
            toast.error('Failed to load outlets');
        } finally {
            setIsLoading(false);
        }
    };

    // Get unique cities for filter dropdown
    const uniqueCities = useMemo(() => {
        const cities = [...new Set(outlets.map((o) => o.city).filter(Boolean))];
        return cities.sort();
    }, [outlets]);

    // Filtered outlets based on all filters
    const filteredOutlets = useMemo(() => {
        return outlets.filter((outlet) => {
            // Search filter
            const matchesSearch = !searchQuery.trim() ||
                outlet.name.toLowerCase().includes(searchQuery.toLowerCase());

            // Brand filter
            const matchesBrand = brandFilter === 'all' || outlet.brand === brandFilter;

            // City filter
            const matchesCity = cityFilter === 'all' || outlet.city === cityFilter;

            return matchesSearch && matchesBrand && matchesCity;
        });
    }, [outlets, searchQuery, brandFilter, cityFilter]);

    // Open dialog for adding
    const handleOpenAddDialog = () => {
        setEditingOutlet(null);
        setDialogOpen(true);
    };

    // Open dialog for editing
    const handleEditOutlet = (outlet: Outlet) => {
        setEditingOutlet(outlet);
        setDialogOpen(true);
    };

    // Create or Update outlet
    const handleSubmitOutlet = async (outletData: Omit<Outlet, 'id'>) => {
        setIsSubmitting(true);
        try {
            if (editingOutlet) {
                // Update existing
                const updated = await updateOutlet(editingOutlet.id, outletData);
                setOutlets((prev) =>
                    prev.map((o) => (o.id === editingOutlet.id ? updated : o))
                        .sort((a, b) => a.name.localeCompare(b.name))
                );
                toast.success(`Outlet "${updated.name}" updated successfully`);
            } else {
                // Create new
                const newOutlet = await createOutlet(outletData);
                setOutlets((prev) =>
                    [...prev, newOutlet].sort((a, b) => a.name.localeCompare(b.name))
                );
                toast.success(`Outlet "${newOutlet.name}" created successfully`);
            }
            setDialogOpen(false);
            setEditingOutlet(null);
        } catch (error) {
            console.error('Error saving outlet:', error);
            const message = error instanceof Error ? error.message : 'Failed to save outlet';
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete outlet
    const handleDeleteOutlet = async (id: number) => {
        const outlet = outlets.find((o) => o.id === id);
        setIsDeletingId(id);
        try {
            await deleteOutlet(id);
            setOutlets((prev) => prev.filter((o) => o.id !== id));
            toast.success(`Outlet "${outlet?.name}" deleted successfully`);
        } catch (error) {
            console.error('Error deleting outlet:', error);
            toast.error('Failed to delete outlet');
        } finally {
            setIsDeletingId(null);
        }
    };

    // Stats
    const stats = useMemo(() => ({
        total: outlets.length,
        fore: outlets.filter((o) => o.brand === 'fore').length,
        kenangan: outlets.filter((o) => o.brand === 'kenangan').length,
        premium: outlets.filter((o) => o.is_premium).length,
    }), [outlets]);

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                <Card className="border-0 shadow-md bg-gradient-to-br from-white to-slate-50">
                    <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-6">
                        <p className="text-xs md:text-sm text-slate-500">Total Outlets</p>
                        <p className="text-xl md:text-2xl font-bold text-slate-900">{stats.total}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
                    <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-6">
                        <p className="text-xs md:text-sm text-blue-600">Fore Coffee</p>
                        <p className="text-xl md:text-2xl font-bold text-blue-700">{stats.fore}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-white">
                    <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-6">
                        <p className="text-xs md:text-sm text-amber-600">Kopi Kenangan</p>
                        <p className="text-xl md:text-2xl font-bold text-amber-700">{stats.kenangan}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-white">
                    <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-6">
                        <p className="text-xs md:text-sm text-purple-600">Premium</p>
                        <p className="text-xl md:text-2xl font-bold text-purple-700">{stats.premium}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl shadow-lg shadow-emerald-500/20">
                                <MapPin className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Outlets</CardTitle>
                                <CardDescription>Manage all outlet locations</CardDescription>
                            </div>
                        </div>

                        <Button onClick={handleOpenAddDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Outlet
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Brand Tabs */}
                    <Tabs value={brandFilter} onValueChange={(v) => setBrandFilter(v as typeof brandFilter)}>
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="all">Semua</TabsTrigger>
                            <TabsTrigger value="fore">Fore Coffee</TabsTrigger>
                            <TabsTrigger value="kenangan">Kopi Kenangan</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* Search and City Filter */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search outlets by name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={cityFilter} onValueChange={setCityFilter}>
                            <SelectTrigger className="w-full sm:w-48">
                                <SelectValue placeholder="Pilih Kota" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Kota</SelectItem>
                                {uniqueCities.map((city) => (
                                    <SelectItem key={city} value={city}>
                                        {city}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Table */}
                    {isLoading ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="animate-pulse">Loading outlets...</div>
                        </div>
                    ) : (
                        <OutletTable
                            outlets={filteredOutlets}
                            onEdit={handleEditOutlet}
                            onDelete={handleDeleteOutlet}
                            isDeleting={isDeletingId}
                        />
                    )}

                    {/* Results count */}
                    {!isLoading && (
                        <p className="text-sm text-slate-500 text-center">
                            Showing {filteredOutlets.length} of {outlets.length} outlets
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Outlet Dialog */}
            <OutletFormDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) setEditingOutlet(null);
                }}
                onSubmit={handleSubmitOutlet}
                isLoading={isSubmitting}
                editingOutlet={editingOutlet}
            />
        </div>
    );
}
