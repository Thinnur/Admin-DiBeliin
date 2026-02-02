// =============================================================================
// DiBeliin Admin - Add Transaction Dialog
// =============================================================================
// Modal form for adding new transactions

import { useState, useEffect } from 'react';
import { Plus, Loader2, DollarSign, Sparkles } from 'lucide-react';

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

import { useAddTransaction } from '@/hooks/useFinance';
import type { TransactionType } from '@/types/database';

// -----------------------------------------------------------------------------
// Category Options
// -----------------------------------------------------------------------------

const INCOME_CATEGORIES = [
    { value: 'penjualan', label: 'Penjualan Akun' },
    { value: 'jasa', label: 'Jasa Lainnya' },
    { value: 'lain', label: 'Pendapatan Lain' },
];

const EXPENSE_CATEGORIES = [
    { value: 'beli_akun', label: 'Beli Akun' },
    { value: 'server', label: 'Server / Hosting' },
    { value: 'operasional', label: 'Biaya Operasional' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'lain', label: 'Pengeluaran Lain' },
];

// -----------------------------------------------------------------------------
// Props Interface
// -----------------------------------------------------------------------------

export interface AddTransactionDialogProps {
    /** Pre-filled data from AI or other sources */
    initialData?: {
        type: TransactionType;
        amount: number;
        date: string;
        description: string;
        category: string;
    };
    /** Controlled open state */
    open?: boolean;
    /** Callback when open state changes */
    onOpenChange?: (open: boolean) => void;
    /** Custom trigger element (defaults to "Add Transaction" button) */
    trigger?: React.ReactNode;
    /** Whether data is from AI analysis */
    isFromAI?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function AddTransactionDialog({
    initialData,
    open: controlledOpen,
    onOpenChange,
    trigger,
    isFromAI = false,
}: AddTransactionDialogProps = {}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const addTransaction = useAddTransaction();

    // Use controlled or internal state
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? (onOpenChange ?? setInternalOpen) : setInternalOpen;

    // Form state
    const [type, setType] = useState<TransactionType>('income');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    // Apply initial data when provided
    useEffect(() => {
        if (initialData && open) {
            setType(initialData.type);
            setAmount(String(initialData.amount));
            setCategory(initialData.category);
            setDescription(initialData.description);
            setDate(initialData.date);
            setErrors({});
        }
    }, [initialData, open]);

    const resetForm = () => {
        setType('income');
        setAmount('');
        setCategory('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setErrors({});
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!amount || Number(amount) <= 0) {
            newErrors.amount = 'Amount must be greater than 0';
        }

        if (!category) {
            newErrors.category = 'Please select a category';
        }

        if (!date) {
            newErrors.date = 'Date is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        try {
            await addTransaction.mutateAsync({
                transaction_type: type,
                amount: Number(amount),
                category,
                description: description || '',
                related_account_id: null,
            });

            resetForm();
            setOpen(false);
        } catch {
            // Error is handled by the mutation hook (toast)
        }
    };

    const handleTypeChange = (newType: TransactionType) => {
        setType(newType);
        setCategory(''); // Reset category when type changes
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) resetForm();
        }}>
            {trigger !== undefined ? (
                <DialogTrigger asChild>{trigger}</DialogTrigger>
            ) : (
                <DialogTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Transaction
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {isFromAI ? (
                            <Sparkles className="h-5 w-5 text-amber-500" />
                        ) : (
                            <DollarSign className="h-5 w-5" />
                        )}
                        {isFromAI ? 'Konfirmasi Transaksi AI' : 'Add Transaction'}
                    </DialogTitle>
                    <DialogDescription>
                        {isFromAI
                            ? 'Data berikut diekstrak oleh AI. Silakan periksa dan edit jika perlu.'
                            : 'Record a new income or expense transaction.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Type */}
                    <div className="space-y-2">
                        <Label htmlFor="type">Transaction Type</Label>
                        <Select value={type} onValueChange={(v) => handleTypeChange(v as TransactionType)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="income">
                                    <span className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-green-500" />
                                        Income
                                    </span>
                                </SelectItem>
                                <SelectItem value="expense">
                                    <span className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-red-500" />
                                        Expense
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount (Rp)</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                Rp
                            </span>
                            <Input
                                id="amount"
                                type="number"
                                placeholder="50000"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className={`pl-10 ${errors.amount ? 'border-red-500' : ''}`}
                            />
                        </div>
                        {errors.amount && (
                            <p className="text-xs text-red-500">{errors.amount}</p>
                        )}
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.category && (
                            <p className="text-xs text-red-500">{errors.category}</p>
                        )}
                    </div>

                    {/* Date */}
                    <div className="space-y-2">
                        <Label htmlFor="date">Date</Label>
                        <Input
                            id="date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className={errors.date ? 'border-red-500' : ''}
                        />
                        {errors.date && (
                            <p className="text-xs text-red-500">{errors.date}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Input
                            id="description"
                            placeholder="e.g., Penjualan akun Kopken ke @customer"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
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
                        <Button type="submit" disabled={addTransaction.isPending}>
                            {addTransaction.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Add Transaction
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
