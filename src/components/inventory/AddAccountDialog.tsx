// =============================================================================
// DiBeliin Admin - Add Account Dialog
// =============================================================================
// Modal form for adding new accounts

import { useState } from 'react';
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
// Voucher Options
// -----------------------------------------------------------------------------

const VOUCHER_OPTIONS = [
    { value: 'No Min', label: 'No Minimum' },
    { value: 'Min 30k', label: 'Min 30k' },
    { value: 'Min 50k', label: 'Min 50k' },
    { value: 'Min 75k', label: 'Min 75k' },
    { value: 'Min 100k', label: 'Min 100k' },
];

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
    const [voucherType, setVoucherType] = useState('No Min');
    const [expiryDate, setExpiryDate] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const resetForm = () => {
        setBrand('kopken');
        setPhoneNumber('');
        setPassword('');
        setVoucherType('No Min');
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
                voucher_type: voucherType,
                expiry_date: expiryDate,
                purchase_price: Number(purchasePrice) || 0,
                status: 'ready',
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

                    {/* Voucher Type & Expiry Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="voucher_type">Voucher Type</Label>
                            <Select value={voucherType} onValueChange={setVoucherType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select voucher" />
                                </SelectTrigger>
                                <SelectContent>
                                    {VOUCHER_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

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
                    </div>

                    {/* Purchase Price */}
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
