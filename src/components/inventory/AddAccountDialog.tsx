// =============================================================================
// DiBeliin Admin - Add/Edit Account Dialog
// =============================================================================
// Modal form for adding new accounts (single or bulk) or editing existing ones

import { useState, useEffect, useMemo } from 'react';
import { Plus, Loader2, FileText, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';

import { useAddAccount, useUpdateAccount } from '@/hooks/useInventory';
import { parseBulkText } from '@/lib/logic/smartParser';
import type { Account, AccountBrand } from '@/types/database';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface AddAccountDialogProps {
    /** If provided, the dialog will be in "edit mode" */
    accountToEdit?: Account | null;
    /** External control: open state */
    open?: boolean;
    /** External control: callback when open state changes */
    onOpenChange?: (open: boolean) => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function AddAccountDialog({
    accountToEdit,
    open: externalOpen,
    onOpenChange: externalOnOpenChange,
}: AddAccountDialogProps) {
    // Internal open state (used when not controlled externally)
    const [internalOpen, setInternalOpen] = useState(false);

    // Determine if we're in controlled mode
    const isControlled = externalOpen !== undefined;
    const open = isControlled ? externalOpen : internalOpen;
    const setOpen = (value: boolean) => {
        if (isControlled && externalOnOpenChange) {
            externalOnOpenChange(value);
        } else {
            setInternalOpen(value);
        }
    };

    // Determine if we're in edit mode
    const isEditMode = !!accountToEdit;

    // Mutations
    const addAccount = useAddAccount();
    const updateAccount = useUpdateAccount();

    // Tab state: 'single' or 'bulk' (only for add mode)
    const [dialogTab, setDialogTab] = useState<'single' | 'bulk'>('single');

    // Single-mode form state
    const [brand, setBrand] = useState<AccountBrand>('kopken');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [isNominReady, setIsNominReady] = useState(true);
    const [isMin50kReady, setIsMin50kReady] = useState(true);
    const [expiryDate, setExpiryDate] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Bulk-mode form state
    const [bulkText, setBulkText] = useState('');
    const [bulkBrand, setBulkBrand] = useState<AccountBrand>('kopken');
    const [bulkExpiryDate, setBulkExpiryDate] = useState('');
    const [bulkPurchasePrice, setBulkPurchasePrice] = useState('');
    const [bulkIsSubmitting, setBulkIsSubmitting] = useState(false);

    // Parse bulk text in real-time
    const parseResult = useMemo(() => {
        if (!bulkText.trim()) return null;
        return parseBulkText(bulkText);
    }, [bulkText]);

    // Auto-fill expiry date from parser when detected
    useEffect(() => {
        if (parseResult?.globalExpiry && !bulkExpiryDate) {
            setBulkExpiryDate(parseResult.globalExpiry);
        }
    }, [parseResult?.globalExpiry]);

    // Initialize form with account data when editing
    useEffect(() => {
        if (accountToEdit) {
            setBrand(accountToEdit.brand);
            setPhoneNumber(accountToEdit.phone_number);
            setPassword(accountToEdit.password || '');
            setIsNominReady(accountToEdit.is_nomin_ready);
            setIsMin50kReady(accountToEdit.is_min50k_ready);
            setExpiryDate(accountToEdit.expiry_date);
            setPurchasePrice(accountToEdit.purchase_price?.toString() || '');
            setNotes(accountToEdit.notes || '');
            setDialogTab('single'); // Always single when editing
        } else {
            resetForm();
        }
    }, [accountToEdit]);

    // When brand changes, update Min 50k checkbox (only for new accounts)
    useEffect(() => {
        if (!isEditMode) {
            if (brand === 'fore') {
                setIsMin50kReady(false); // Fore doesn't have Min 50k
            } else {
                setIsMin50kReady(true); // Reset to true for KopKen
            }
        }
    }, [brand, isEditMode]);

    const resetForm = () => {
        setBrand('kopken');
        setPhoneNumber('');
        setPassword('');
        setIsNominReady(true);
        setIsMin50kReady(true);
        setExpiryDate('');
        setPurchasePrice('');
        setNotes('');
        setErrors({});
        setBulkText('');
        setBulkBrand('kopken');
        setBulkExpiryDate('');
        setBulkPurchasePrice('');
        setDialogTab('single');
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!phoneNumber.trim()) {
            newErrors.phoneNumber = 'Phone number is required';
        } else if (phoneNumber.length < 10) {
            newErrors.phoneNumber = 'Phone number must be at least 10 digits';
        }

        if (!password.trim()) {
            newErrors.password = 'Password is required';
        }

        if (!expiryDate) {
            newErrors.expiryDate = 'Expiry date is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Single account submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        try {
            if (isEditMode && accountToEdit) {
                // Update existing account
                await updateAccount.mutateAsync({
                    id: accountToEdit.id,
                    updates: {
                        brand,
                        phone_number: phoneNumber,
                        password,
                        expiry_date: expiryDate,
                        purchase_price: Number(purchasePrice) || 0,
                        is_nomin_ready: isNominReady,
                        is_min50k_ready: brand === 'kopken' ? isMin50kReady : false,
                        notes: notes || null,
                    },
                });
            } else {
                // Create new account
                await addAccount.mutateAsync({
                    brand,
                    phone_number: phoneNumber,
                    password,
                    voucher_type: 'Multi', // Legacy field, kept for compatibility
                    expiry_date: expiryDate,
                    purchase_price: Number(purchasePrice) || 0,
                    status: 'ready',
                    is_nomin_ready: isNominReady,
                    is_min50k_ready: brand === 'kopken' ? isMin50kReady : false,
                    notes: notes || null,
                    in_use_by: null,
                });
            }

            resetForm();
            setOpen(false);
        } catch {
            // Error is handled by the mutation hook (toast)
        }
    };

    // Bulk submit
    const handleBulkSubmit = async () => {
        if (!parseResult || parseResult.detectedCount === 0) return;
        if (!bulkExpiryDate) return;

        setBulkIsSubmitting(true);
        try {
            const price = Number(bulkPurchasePrice) || 0;

            // Submit accounts sequentially (to avoid race conditions with auto-expense)
            for (const account of parseResult.accounts) {
                await addAccount.mutateAsync({
                    brand: bulkBrand,
                    phone_number: account.phone,
                    password: account.password,
                    voucher_type: 'Multi',
                    expiry_date: bulkExpiryDate,
                    purchase_price: price,
                    status: 'ready',
                    is_nomin_ready: true,
                    is_min50k_ready: bulkBrand === 'kopken',
                    notes: null,
                    in_use_by: null,
                });
            }

            resetForm();
            setOpen(false);
        } catch {
            // Error is handled by the mutation hook (toast)
        } finally {
            setBulkIsSubmitting(false);
        }
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            resetForm();
        }
    };

    const isPending = addAccount.isPending || updateAccount.isPending;

    // -------------------------------------------------------------------------
    // Single Account Form
    // -------------------------------------------------------------------------
    const singleForm = (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Brand */}
            <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Select value={brand} onValueChange={(v) => setBrand(v as AccountBrand)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="kopken">Kopi Kenangan</SelectItem>
                        <SelectItem value="fore">Fore Coffee</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Phone Number & Password Row */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                        id="phone_number"
                        placeholder="08123456789"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className={errors.phoneNumber ? 'border-red-500' : ''}
                    />
                    {errors.phoneNumber && (
                        <p className="text-xs text-red-500">{errors.phoneNumber}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                        id="password"
                        type="password"
                        placeholder="••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={errors.password ? 'border-red-500' : ''}
                    />
                    {errors.password && (
                        <p className="text-xs text-red-500">{errors.password}</p>
                    )}
                </div>
            </div>

            {/* Voucher Checkboxes */}
            <div className="space-y-3">
                <Label>Available Vouchers</Label>
                <div className="flex flex-col gap-2">
                    {/* No Min Checkbox */}
                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                            type="checkbox"
                            checked={isNominReady}
                            onChange={(e) => setIsNominReady(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900">Voucher No Min</span>
                            <span className="text-xs text-slate-500">No minimum purchase required</span>
                        </div>
                    </label>

                    {/* Min 50k Checkbox - Only for KopKen */}
                    {brand === 'kopken' && (
                        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                            <input
                                type="checkbox"
                                checked={isMin50kReady}
                                onChange={(e) => setIsMin50kReady(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-900">Voucher Min 50k</span>
                                <span className="text-xs text-slate-500">Minimum purchase Rp 50.000</span>
                            </div>
                        </label>
                    )}

                    {/* Info for Fore */}
                    {brand === 'fore' && (
                        <div className="p-3 bg-slate-50 border border-dashed rounded-lg">
                            <p className="text-xs text-slate-500">
                                Fore Coffee accounts only have the No Min voucher.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Expiry Date & Price Row */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="expiry_date">Expiry Date</Label>
                    <Input
                        id="expiry_date"
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className={errors.expiryDate ? 'border-red-500' : ''}
                    />
                    {errors.expiryDate && (
                        <p className="text-xs text-red-500">{errors.expiryDate}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="purchase_price">Purchase Price (Rp)</Label>
                    <Input
                        id="purchase_price"
                        type="number"
                        placeholder="50000"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                    />
                </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                    id="notes"
                    placeholder="Any additional notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            </div>

            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                >
                    Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                    {isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isEditMode ? 'Simpan Perubahan' : 'Add Account'}
                </Button>
            </DialogFooter>
        </form>
    );

    // -------------------------------------------------------------------------
    // Bulk Import Form
    // -------------------------------------------------------------------------
    const bulkForm = (
        <div className="space-y-4">
            {/* Brand */}
            <div className="space-y-2">
                <Label>Brand</Label>
                <Select value={bulkBrand} onValueChange={(v) => setBulkBrand(v as AccountBrand)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="kopken">Kopi Kenangan</SelectItem>
                        <SelectItem value="fore">Fore Coffee</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Paste Text Area */}
            <div className="space-y-2">
                <Label>Paste Text dari Seller</Label>
                <Textarea
                    placeholder={`Paste text dari seller di sini...\n\nContoh:\nakun :\n+6285607637577\n+6283821585437\n085839073898\n\nPin : 080808\nBerlaku sampai : 20 maret 2026`}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                />
            </div>

            {/* Preview Summary */}
            {parseResult && parseResult.detectedCount > 0 && (
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg space-y-1.5">
                    <p className="text-sm font-semibold text-violet-800">
                        ✓ Terdeteksi {parseResult.detectedCount} akun
                    </p>
                    {parseResult.accounts[0]?.password && (
                        <p className="text-xs text-violet-700">
                            Default Password: <span className="font-mono font-medium">{parseResult.accounts[0].password}</span>
                        </p>
                    )}
                    {parseResult.globalExpiry && (
                        <p className="text-xs text-violet-700">
                            Expiry: <span className="font-medium">{parseResult.globalExpiry}</span>
                        </p>
                    )}
                    <div className="pt-1.5 border-t border-violet-200 mt-1.5">
                        <p className="text-[11px] text-violet-600">
                            Nomor: {parseResult.accounts.map(a => a.phone).join(', ')}
                        </p>
                    </div>
                </div>
            )}

            {bulkText.trim() && (!parseResult || parseResult.detectedCount === 0) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-700">
                        Tidak ada nomor HP terdeteksi. Pastikan format nomor benar (contoh: +6281234567890, 081234567890).
                    </p>
                </div>
            )}

            {/* Expiry Date & Price Row */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Expiry Date</Label>
                    <Input
                        type="date"
                        value={bulkExpiryDate}
                        onChange={(e) => setBulkExpiryDate(e.target.value)}
                        className={parseResult?.globalExpiry ? 'border-violet-300 bg-violet-50/50' : ''}
                    />
                    {parseResult?.globalExpiry && (
                        <p className="text-[11px] text-violet-600">Auto-detected dari text</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label>Harga per Akun (Rp)</Label>
                    <Input
                        type="number"
                        placeholder="50000"
                        value={bulkPurchasePrice}
                        onChange={(e) => setBulkPurchasePrice(e.target.value)}
                    />
                </div>
            </div>

            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                >
                    Batal
                </Button>
                <Button
                    onClick={handleBulkSubmit}
                    disabled={
                        bulkIsSubmitting ||
                        !parseResult ||
                        parseResult.detectedCount === 0 ||
                        !bulkExpiryDate
                    }
                >
                    {bulkIsSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Import {parseResult?.detectedCount || 0} Akun
                </Button>
            </DialogFooter>
        </div>
    );

    // -------------------------------------------------------------------------
    // Dialog Content
    // -------------------------------------------------------------------------
    const dialogContent = (
        <DialogContent className="sm:max-w-[540px]">
            <DialogHeader>
                <DialogTitle>
                    {isEditMode ? 'Edit Akun' : 'Tambah Akun'}
                </DialogTitle>
                <DialogDescription>
                    {isEditMode
                        ? 'Ubah informasi akun yang sudah ada.'
                        : 'Tambah akun baru ke inventory. Pilih mode single atau bulk import.'}
                </DialogDescription>
            </DialogHeader>

            {isEditMode ? (
                // Edit mode: single form only, no tabs
                singleForm
            ) : (
                // Add mode: tabs for single or bulk
                <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as 'single' | 'bulk')}>
                    <TabsList className="w-full">
                        <TabsTrigger value="single" className="flex-1 gap-2">
                            <User className="h-3.5 w-3.5" />
                            Single
                        </TabsTrigger>
                        <TabsTrigger value="bulk" className="flex-1 gap-2">
                            <FileText className="h-3.5 w-3.5" />
                            Bulk Import
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="single" className="mt-4">
                        {singleForm}
                    </TabsContent>

                    <TabsContent value="bulk" className="mt-4">
                        {bulkForm}
                    </TabsContent>
                </Tabs>
            )}
        </DialogContent>
    );

    // If controlled externally, render without trigger
    if (isControlled) {
        return (
            <Dialog open={open} onOpenChange={handleOpenChange}>
                {dialogContent}
            </Dialog>
        );
    }

    // Uncontrolled mode: render with trigger button
    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Account
                </Button>
            </DialogTrigger>
            {dialogContent}
        </Dialog>
    );
}
