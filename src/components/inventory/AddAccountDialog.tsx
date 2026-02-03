// =============================================================================
// DiBeliin Admin - Add/Edit Account Dialog
// =============================================================================
// Modal form for adding new accounts or editing existing ones

import { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import { useAddAccount, useUpdateAccount } from '@/hooks/useInventory';
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

    // Form state
    const [brand, setBrand] = useState<AccountBrand>('kopken');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [isNominReady, setIsNominReady] = useState(true);
    const [isMin50kReady, setIsMin50kReady] = useState(true);
    const [expiryDate, setExpiryDate] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

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
                });
            }

            resetForm();
            setOpen(false);
        } catch {
            // Error is handled by the mutation hook (toast)
        }
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            resetForm();
        }
    };

    const isPending = addAccount.isPending || updateAccount.isPending;

    // If controlled externally, don't render the trigger button
    const dialogContent = (
        <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
                <DialogTitle>
                    {isEditMode ? 'Edit Akun' : 'Add New Account'}
                </DialogTitle>
                <DialogDescription>
                    {isEditMode
                        ? 'Ubah informasi akun yang sudah ada.'
                        : 'Add a new coffee shop account to inventory. Fill in all required fields.'}
                </DialogDescription>
            </DialogHeader>

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

