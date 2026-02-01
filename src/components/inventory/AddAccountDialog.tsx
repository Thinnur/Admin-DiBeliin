// =============================================================================
// DiBeliin Admin - Add Account Dialog
// =============================================================================
// Modal form for adding new accounts

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

import { useAddAccount } from '@/hooks/useInventory';
import type { AccountBrand } from '@/types/database';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function AddAccountDialog() {
    const [open, setOpen] = useState(false);
    const addAccount = useAddAccount();

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

    // When brand changes, update Min 50k checkbox
    useEffect(() => {
        if (brand === 'fore') {
            setIsMin50kReady(false); // Fore doesn't have Min 50k
        } else {
            setIsMin50kReady(true); // Reset to true for KopKen
        }
    }, [brand]);

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
            await addAccount.mutateAsync({
                brand,
                phone_number: phoneNumber,
                password,
                voucher_type: 'Multi', // Legacy field, kept for compatibility
                expiry_date: expiryDate,
                purchase_price: Number(purchasePrice) || 0,
                status: 'ready',
                is_nomin_ready: isNominReady,
                is_min50k_ready: brand === 'kopken' ? isMin50kReady : false, // Fore always false
                notes: notes || null,
            });

            resetForm();
            setOpen(false);
        } catch {
            // Error is handled by the mutation hook (toast)
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) resetForm();
        }}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Account
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add New Account</DialogTitle>
                    <DialogDescription>
                        Add a new coffee shop account to inventory. Fill in all required fields.
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
                        <Button type="submit" disabled={addAccount.isPending}>
                            {addAccount.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Add Account
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

