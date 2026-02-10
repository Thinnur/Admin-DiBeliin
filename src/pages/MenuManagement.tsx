// =============================================================================
// DiBeliin Admin - Menu Management Page
// =============================================================================
// Edit menu item prices, availability, names, brands, and categories

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Coffee, Edit2, Check, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

import { getMenuItems, updateMenuItem, createMenuItem, type MenuItem, type MenuItemUpdate } from '@/services/menuService';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type BrandFilter = 'all' | 'fore' | 'kenangan';

// -----------------------------------------------------------------------------
// Category Tag Input (shared component)
// -----------------------------------------------------------------------------

interface CategoryTagInputProps {
    categories: string[];
    onChange: (categories: string[]) => void;
    suggestions: string[];
    placeholder?: string;
}

function CategoryTagInput({ categories, onChange, suggestions, placeholder }: CategoryTagInputProps) {
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close suggestions on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredSuggestions = suggestions.filter(
        (s) =>
            !categories.includes(s) &&
            s.toLowerCase().includes(inputValue.toLowerCase())
    );

    const addCategory = (cat: string) => {
        const trimmed = cat.trim();
        if (trimmed && !categories.includes(trimmed)) {
            onChange([...categories, trimmed]);
        }
        setInputValue('');
        setShowSuggestions(false);
    };

    const removeCategory = (cat: string) => {
        onChange(categories.filter((c) => c !== cat));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            addCategory(inputValue);
        } else if (e.key === 'Backspace' && !inputValue && categories.length > 0) {
            removeCategory(categories[categories.length - 1]);
        }
    };

    return (
        <div ref={wrapperRef} className="relative">
            {/* Selected tags */}
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                {categories.map((cat) => (
                    <Badge
                        key={cat}
                        variant="secondary"
                        className="gap-1 pr-1 bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                        {cat}
                        <button
                            type="button"
                            onClick={() => removeCategory(cat)}
                            className="ml-0.5 rounded-full p-0.5 hover:bg-slate-300 transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                ))}
            </div>
            {/* Input */}
            <Input
                placeholder={placeholder || 'Ketik kategori lalu Enter...'}
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
            />
            {/* Suggestions dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {filteredSuggestions.map((s) => (
                        <button
                            key={s}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addCategory(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// -----------------------------------------------------------------------------
// Edit Dialog
// -----------------------------------------------------------------------------

interface EditDialogProps {
    item: MenuItem | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: number, data: MenuItemUpdate) => Promise<void>;
    isSaving: boolean;
    categoriesByBrand: Record<string, string[]>;
}

function EditMenuDialog({ item, isOpen, onClose, onSave, isSaving, categoriesByBrand }: EditDialogProps) {
    const [name, setName] = useState('');
    const [brand, setBrand] = useState<'fore' | 'kenangan'>('fore');
    const [categories, setCategories] = useState<string[]>([]);
    const [regularPrice, setRegularPrice] = useState('');
    const [largePrice, setLargePrice] = useState('');
    const [isAvailable, setIsAvailable] = useState(true);

    useEffect(() => {
        if (item) {
            setName(item.name);
            setBrand(item.brand);
            setCategories(item.categories || []);
            setRegularPrice(item.regular_price?.toString() || '');
            setLargePrice(item.large_price?.toString() || '');
            setIsAvailable(item.is_available);
        }
    }, [item]);

    // Reset categories when brand changes (keep only those valid for new brand)
    const handleBrandChange = (newBrand: 'fore' | 'kenangan') => {
        setBrand(newBrand);
        const validCats = categoriesByBrand[newBrand] || [];
        setCategories((prev) => prev.filter((c) => validCats.includes(c)));
    };

    const handleSave = async () => {
        if (!item) return;

        if (!name.trim()) {
            toast.error('Nama menu harus diisi');
            return;
        }
        if (categories.length === 0) {
            toast.error('Minimal satu kategori harus dipilih');
            return;
        }

        await onSave(item.id, {
            name: name.trim(),
            brand,
            categories,
            regular_price: regularPrice ? Number(regularPrice) : null,
            large_price: largePrice ? Number(largePrice) : null,
            is_available: isAvailable,
        });
    };

    if (!item) return null;

    const brandSuggestions = categoriesByBrand[brand] || [];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Menu</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">Nama Menu *</Label>
                        <Input
                            id="edit-name"
                            placeholder="Nama menu"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    {/* Brand */}
                    <div className="space-y-2">
                        <Label htmlFor="edit-brand">Brand *</Label>
                        <Select value={brand} onValueChange={(v) => handleBrandChange(v as 'fore' | 'kenangan')}>
                            <SelectTrigger id="edit-brand">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fore">Fore Coffee</SelectItem>
                                <SelectItem value="kenangan">Kopi Kenangan</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Categories */}
                    <div className="space-y-2">
                        <Label>Kategori *</Label>
                        <CategoryTagInput
                            categories={categories}
                            onChange={setCategories}
                            suggestions={brandSuggestions}
                            placeholder="Pilih atau ketik kategori..."
                        />
                    </div>

                    {/* Prices */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-regularPrice">Harga Regular (Rp)</Label>
                            <Input
                                id="edit-regularPrice"
                                type="number"
                                placeholder="0"
                                value={regularPrice}
                                onChange={(e) => setRegularPrice(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-largePrice">Harga Large (Rp)</Label>
                            <Input
                                id="edit-largePrice"
                                type="number"
                                placeholder="0"
                                value={largePrice}
                                onChange={(e) => setLargePrice(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Availability */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border">
                        <div>
                            <Label htmlFor="edit-availability" className="font-medium">Status Ketersediaan</Label>
                            <p className="text-sm text-slate-500">
                                {isAvailable ? 'Menu tersedia untuk dipesan' : 'Menu tidak tersedia'}
                            </p>
                        </div>
                        <Switch
                            id="edit-availability"
                            checked={isAvailable}
                            onCheckedChange={setIsAvailable}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>
                        <X className="h-4 w-4 mr-2" />
                        Batal
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        <Check className="h-4 w-4 mr-2" />
                        {isSaving ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// -----------------------------------------------------------------------------
// Add Menu Dialog
// -----------------------------------------------------------------------------

interface AddMenuDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: Omit<MenuItem, 'id' | 'created_at'>) => Promise<void>;
    isSaving: boolean;
    categoriesByBrand: Record<string, string[]>;
}

function AddMenuDialog({ isOpen, onClose, onSave, isSaving, categoriesByBrand }: AddMenuDialogProps) {
    const [name, setName] = useState('');
    const [brand, setBrand] = useState<'fore' | 'kenangan'>('fore');
    const [categories, setCategories] = useState<string[]>([]);
    const [description, setDescription] = useState('');
    const [regularPrice, setRegularPrice] = useState('');
    const [largePrice, setLargePrice] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isAvailable, setIsAvailable] = useState(true);

    const resetForm = () => {
        setName('');
        setBrand('fore');
        setCategories([]);
        setDescription('');
        setRegularPrice('');
        setLargePrice('');
        setImageUrl('');
        setIsAvailable(true);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    // Reset categories when brand changes
    const handleBrandChange = (newBrand: 'fore' | 'kenangan') => {
        setBrand(newBrand);
        const validCats = categoriesByBrand[newBrand] || [];
        setCategories((prev) => prev.filter((c) => validCats.includes(c)));
    };

    const handleSave = async () => {
        if (!name.trim() || categories.length === 0) {
            toast.error('Nama menu dan minimal satu kategori harus diisi');
            return;
        }

        const newItem: Omit<MenuItem, 'id' | 'created_at'> = {
            name: name.trim(),
            brand,
            categories,
            description: description.trim() || null,
            image_url: imageUrl.trim() || null,
            regular_price: regularPrice ? Number(regularPrice) : null,
            large_price: largePrice ? Number(largePrice) : null,
            regular_discount_price: null,
            large_discount_price: null,
            badge: null,
            is_available: isAvailable,
        };

        await onSave(newItem);
        resetForm();
    };

    const brandSuggestions = categoriesByBrand[brand] || [];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Tambah Menu Baru</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Nama Menu *</Label>
                        <Input
                            id="name"
                            placeholder="Contoh: Kopi Kenangan Mantan"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    {/* Brand */}
                    <div className="space-y-2">
                        <Label htmlFor="brand">Brand *</Label>
                        <Select value={brand} onValueChange={(v) => handleBrandChange(v as 'fore' | 'kenangan')}>
                            <SelectTrigger id="brand">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fore">Fore Coffee</SelectItem>
                                <SelectItem value="kenangan">Kopi Kenangan</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Categories */}
                    <div className="space-y-2">
                        <Label>Kategori *</Label>
                        <CategoryTagInput
                            categories={categories}
                            onChange={setCategories}
                            suggestions={brandSuggestions}
                            placeholder="Pilih atau ketik kategori..."
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Deskripsi (Opsional)</Label>
                        <Textarea
                            id="description"
                            placeholder="Deskripsi menu..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                        />
                    </div>

                    {/* Prices */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="regularPrice">Harga Regular (Rp)</Label>
                            <Input
                                id="regularPrice"
                                type="number"
                                placeholder="0"
                                value={regularPrice}
                                onChange={(e) => setRegularPrice(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="largePrice">Harga Large (Rp)</Label>
                            <Input
                                id="largePrice"
                                type="number"
                                placeholder="0"
                                value={largePrice}
                                onChange={(e) => setLargePrice(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Image URL */}
                    <div className="space-y-2">
                        <Label htmlFor="imageUrl">Image URL (Opsional)</Label>
                        <Input
                            id="imageUrl"
                            type="url"
                            placeholder="https://..."
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                        />
                    </div>

                    {/* Availability */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border">
                        <div>
                            <Label htmlFor="availability-new" className="font-medium">Status Ketersediaan</Label>
                            <p className="text-sm text-slate-500">
                                {isAvailable ? 'Menu tersedia untuk dipesan' : 'Menu tidak tersedia'}
                            </p>
                        </div>
                        <Switch
                            id="availability-new"
                            checked={isAvailable}
                            onCheckedChange={setIsAvailable}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                        <X className="h-4 w-4 mr-2" />
                        Batal
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        <Check className="h-4 w-4 mr-2" />
                        {isSaving ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// -----------------------------------------------------------------------------
// Menu Table
// -----------------------------------------------------------------------------

interface MenuTableProps {
    items: MenuItem[];
    onEdit: (item: MenuItem) => void;
}

function MenuTable({ items, onEdit }: MenuTableProps) {
    const formatCurrency = (amount: number | null) => {
        if (amount === null) return '—';
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const getBrandBadge = (brand: string) => {
        return brand === 'fore' ? (
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Fore</Badge>
        ) : (
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Kenangan</Badge>
        );
    };

    // Sort: primary = first category (ascending), secondary = name (ascending)
    const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => {
            const catA = (a.categories?.[0] || '').toLowerCase();
            const catB = (b.categories?.[0] || '').toLowerCase();
            if (catA < catB) return -1;
            if (catA > catB) return 1;
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
    }, [items]);

    if (sortedItems.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500">
                <Coffee className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">Tidak ada menu ditemukan</p>
                <p className="text-sm">Coba filter atau kata kunci lain</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nama Menu</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-right">Harga Regular</TableHead>
                        <TableHead className="text-right">Harga Large</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedItems.map((item) => (
                        <TableRow key={item.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onEdit(item)}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{getBrandBadge(item.brand)}</TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {(item.categories || []).map((cat) => (
                                        <Badge
                                            key={cat}
                                            variant="outline"
                                            className="text-xs font-normal text-slate-600 border-slate-300"
                                        >
                                            {cat}
                                        </Badge>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                                {formatCurrency(item.regular_price)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                                {formatCurrency(item.large_price)}
                            </TableCell>
                            <TableCell>
                                {item.is_available ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                        Tersedia
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary" className="bg-red-100 text-red-700">
                                        Kosong
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(item);
                                    }}
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Main Page
// -----------------------------------------------------------------------------

export default function MenuManagement() {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [brandFilter, setBrandFilter] = useState<BrandFilter>('all');
    const [categoryFilter, setCategoryFilter] = useState('all');

    // Edit dialog state
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    // Add dialog state
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch menu items
    useEffect(() => {
        fetchMenuItems();
    }, []);

    const fetchMenuItems = async () => {
        try {
            setIsLoading(true);
            const items = await getMenuItems();
            setMenuItems(items);
        } catch (error) {
            console.error('Error fetching menu items:', error);
            toast.error('Gagal memuat daftar menu');
        } finally {
            setIsLoading(false);
        }
    };

    // Extract unique categories (filtered by current brand selection)
    const uniqueCategories = useMemo(() => {
        const categories = new Set<string>();
        menuItems
            .filter((item) => brandFilter === 'all' || item.brand === brandFilter)
            .forEach((item) => {
                (item.categories || []).forEach((cat) => categories.add(cat));
            });
        return Array.from(categories).sort();
    }, [menuItems, brandFilter]);

    // Reset category filter when brand filter changes
    useEffect(() => {
        setCategoryFilter('all');
    }, [brandFilter]);

    // Categories grouped by brand
    const categoriesByBrand = useMemo(() => {
        const map: Record<string, Set<string>> = { fore: new Set(), kenangan: new Set() };
        menuItems.forEach((item) => {
            (item.categories || []).forEach((cat) => {
                map[item.brand]?.add(cat);
            });
        });
        return {
            fore: Array.from(map.fore).sort(),
            kenangan: Array.from(map.kenangan).sort(),
        };
    }, [menuItems]);

    // Filter items
    const filteredItems = menuItems.filter((item) => {
        const matchesBrand = brandFilter === 'all' || item.brand === brandFilter;
        const matchesCategory =
            categoryFilter === 'all' || (item.categories || []).includes(categoryFilter);
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
            item.name.toLowerCase().includes(searchLower) ||
            (item.categories || []).some((c) => c.toLowerCase().includes(searchLower));
        return matchesBrand && matchesCategory && matchesSearch;
    });

    // Edit handlers
    const handleEdit = (item: MenuItem) => {
        setEditingItem(item);
        setIsEditDialogOpen(true);
    };

    // Helper function to sanitize price input
    const sanitizePrice = (value: unknown): number | null => {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        // Strip any non-numeric characters (like "Rp", ".", spaces)
        const cleanedString = String(value).replace(/[^0-9]/g, '');
        if (!cleanedString) {
            return null;
        }
        const parsed = parseInt(cleanedString, 10);
        return isNaN(parsed) ? null : parsed;
    };

    const handleSave = async (id: number, data: MenuItemUpdate) => {
        setIsSaving(true);
        try {
            // Sanitize price inputs - force to integer or null
            const regularPrice = sanitizePrice(data.regular_price);
            const largePrice = sanitizePrice(data.large_price);

            // Construct clean payload
            const payload: MenuItemUpdate = {
                name: data.name,
                brand: data.brand,
                categories: data.categories,
                regular_price: regularPrice,
                large_price: largePrice,
                is_available: data.is_available ?? true,
            };

            console.log('Updating menu item ID:', id);
            console.log('Payload:', payload);

            const updated = await updateMenuItem(id, payload);
            setMenuItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
            toast.success('Menu berhasil diperbarui');
            setIsEditDialogOpen(false);
            setEditingItem(null);
        } catch (error) {
            console.error('Full error object:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast.error(`Gagal update: ${errorMessage}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Add handlers
    const handleAdd = () => {
        setIsAddDialogOpen(true);
    };

    const handleCreate = async (item: Omit<MenuItem, 'id' | 'created_at'>) => {
        setIsSaving(true);
        try {
            const newItem = await createMenuItem(item);
            setMenuItems((prev) => [...prev, newItem]);
            toast.success('Menu berhasil ditambahkan');
            setIsAddDialogOpen(false);
        } catch (error) {
            console.error('Error creating menu item:', error);
            toast.error('Gagal menambahkan menu');
        } finally {
            setIsSaving(false);
        }
    };

    // Stats
    const totalItems = menuItems.length;
    const availableItems = menuItems.filter((item) => item.is_available).length;
    const foreItems = menuItems.filter((item) => item.brand === 'fore').length;
    const kenanganItems = menuItems.filter((item) => item.brand === 'kenangan').length;

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-0 shadow-md">
                    <CardContent className="pt-6">
                        <p className="text-2xl font-bold text-slate-900">{totalItems}</p>
                        <p className="text-sm text-slate-500">Total Menu</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                    <CardContent className="pt-6">
                        <p className="text-2xl font-bold text-emerald-600">{availableItems}</p>
                        <p className="text-sm text-slate-500">Tersedia</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                    <CardContent className="pt-6">
                        <p className="text-2xl font-bold text-blue-600">{foreItems}</p>
                        <p className="text-sm text-slate-500">Fore Coffee</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                    <CardContent className="pt-6">
                        <p className="text-2xl font-bold text-amber-600">{kenanganItems}</p>
                        <p className="text-sm text-slate-500">Kopi Kenangan</p>
                    </CardContent>
                </Card>
            </div>

            {/* Menu List */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl shadow-lg shadow-amber-500/20">
                                <Coffee className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Daftar Menu</CardTitle>
                                <CardDescription>Kelola harga dan ketersediaan menu</CardDescription>
                            </div>
                        </div>
                        <Button onClick={handleAdd} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Tambah Menu
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari menu..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {/* Brand Filter Tabs */}
                        <div className="flex gap-2">
                            {(['all', 'fore', 'kenangan'] as BrandFilter[]).map((brand) => (
                                <Button
                                    key={brand}
                                    variant={brandFilter === brand ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setBrandFilter(brand)}
                                    className={brandFilter === brand ? '' : 'text-slate-600'}
                                >
                                    {brand === 'all' ? 'Semua' : brand === 'fore' ? 'Fore' : 'Kenangan'}
                                </Button>
                            ))}
                        </div>

                        {/* Category Filter */}
                        <div className="w-full sm:w-auto">
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-full sm:w-[200px]">
                                    <SelectValue placeholder="Filter Kategori" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Kategori</SelectItem>
                                    {uniqueCategories.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Table */}
                    {isLoading ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="animate-pulse">Memuat menu...</div>
                        </div>
                    ) : (
                        <MenuTable items={filteredItems} onEdit={handleEdit} />
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <EditMenuDialog
                item={editingItem}
                isOpen={isEditDialogOpen}
                onClose={() => {
                    setIsEditDialogOpen(false);
                    setEditingItem(null);
                }}
                onSave={handleSave}
                isSaving={isSaving}
                categoriesByBrand={categoriesByBrand}
            />

            {/* Add Dialog */}
            <AddMenuDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                onSave={handleCreate}
                isSaving={isSaving}
                categoriesByBrand={categoriesByBrand}
            />
        </div>
    );
}
