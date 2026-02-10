// =============================================================================
// DiBeliin Admin - Add Transaction Dialog
// =============================================================================
// Modal form for adding new transactions (single or bulk)

import { useState, useEffect, useMemo } from 'react';
import { Plus, Loader2, DollarSign, Sparkles, FileText, User } from 'lucide-react';

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

import { useAddTransaction } from '@/hooks/useFinance';
import { parseTransactionBulkText } from '@/lib/logic/transactionParser';
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

// Formatter for Rupiah
function formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

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

    // Dialog mode: 'single' or 'bulk'
    const [dialogTab, setDialogTab] = useState<'single' | 'bulk'>('single');

    // Single-mode form state
    const [type, setType] = useState<TransactionType>('income');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Bulk-mode form state
    const [bulkType, setBulkType] = useState<TransactionType>('income');
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkDate, setBulkDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [bulkText, setBulkText] = useState('');
    const [bulkIsSubmitting, setBulkIsSubmitting] = useState(false);

    const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const bulkCategories = bulkType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    // Parse bulk text in real-time
    const parseResult = useMemo(() => {
        if (!bulkText.trim()) return null;
        return parseTransactionBulkText(bulkText);
    }, [bulkText]);

    // Apply initial data when provided
    useEffect(() => {
        if (initialData && open) {
            setType(initialData.type);
            setAmount(String(initialData.amount));
            setCategory(initialData.category);
            setDescription(initialData.description);
            setDate(initialData.date);
            setErrors({});
            setDialogTab('single');
        }
    }, [initialData, open]);

    const resetForm = () => {
        setType('income');
        setAmount('');
        setCategory('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setErrors({});
        setBulkType('income');
        setBulkCategory('');
        setBulkDate(new Date().toISOString().split('T')[0]);
        setBulkText('');
        setDialogTab('single');
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

    // Single submit
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

    // Bulk submit
    const handleBulkSubmit = async () => {
        if (!parseResult || parseResult.detectedCount === 0) return;
        if (!bulkCategory || !bulkDate) return;

        setBulkIsSubmitting(true);
        try {
            for (const txn of parseResult.transactions) {
                await addTransaction.mutateAsync({
                    transaction_type: bulkType,
                    amount: txn.amount,
                    category: bulkCategory,
                    description: txn.description || '',
                    related_account_id: null,
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

    const handleTypeChange = (newType: TransactionType) => {
        setType(newType);
        setCategory(''); // Reset category when type changes
    };

    const handleBulkTypeChange = (newType: TransactionType) => {
        setBulkType(newType);
        setBulkCategory(''); // Reset category when type changes
    };

    // -------------------------------------------------------------------------
    // Single Transaction Form
    // -------------------------------------------------------------------------
    const singleForm = (
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
    );

    // -------------------------------------------------------------------------
    // Bulk Import Form
    // -------------------------------------------------------------------------
    const bulkForm = (
        <div className="space-y-4">
            {/* Type & Category Row */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Tipe Transaksi</Label>
                    <Select value={bulkType} onValueChange={(v) => handleBulkTypeChange(v as TransactionType)}>
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
                <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={bulkCategory} onValueChange={setBulkCategory}>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih kategori" />
                        </SelectTrigger>
                        <SelectContent>
                            {bulkCategories.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
                <Label>Tanggal (berlaku untuk semua)</Label>
                <Input
                    type="date"
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                />
            </div>

            {/* Paste Text Area */}
            <div className="space-y-2">
                <Label>Data Transaksi (satu per baris)</Label>
                <Textarea
                    placeholder={`Satu transaksi per baris: nominal deskripsi\n\nContoh:\n50000 Penjualan akun KopKen @user1\n50000 Penjualan akun KopKen @user2\n75000 Penjualan akun Fore @user3\nRp 50.000 Jasa order\n25000`}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={7}
                    className="font-mono text-sm"
                />
            </div>

            {/* Preview Summary */}
            {parseResult && parseResult.detectedCount > 0 && (
                <div className={`p-3 border rounded-lg space-y-2 ${bulkType === 'income'
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-red-50 border-red-200'
                    }`}>
                    <p className={`text-sm font-semibold ${bulkType === 'income' ? 'text-emerald-800' : 'text-red-800'
                        }`}>
                        ✓ Terdeteksi {parseResult.detectedCount} transaksi
                    </p>
                    <p className={`text-xs ${bulkType === 'income' ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                        Total: <span className="font-semibold">{formatRupiah(parseResult.totalAmount)}</span>
                    </p>

                    {/* Transaction list preview */}
                    <div className={`pt-2 border-t space-y-1 ${bulkType === 'income' ? 'border-emerald-200' : 'border-red-200'
                        }`}>
                        {parseResult.transactions.slice(0, 5).map((txn, i) => (
                            <div key={i} className={`flex justify-between text-xs ${bulkType === 'income' ? 'text-emerald-700' : 'text-red-700'
                                }`}>
                                <span className="truncate mr-2">{txn.description || '(tanpa deskripsi)'}</span>
                                <span className="font-mono font-medium whitespace-nowrap">
                                    {formatRupiah(txn.amount)}
                                </span>
                            </div>
                        ))}
                        {parseResult.detectedCount > 5 && (
                            <p className={`text-[11px] ${bulkType === 'income' ? 'text-emerald-600' : 'text-red-600'
                                }`}>
                                ...dan {parseResult.detectedCount - 5} lainnya
                            </p>
                        )}
                    </div>
                </div>
            )}

            {bulkText.trim() && (!parseResult || parseResult.detectedCount === 0) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-700">
                        Tidak ada transaksi terdeteksi. Format: <span className="font-mono">nominal deskripsi</span> (satu per baris).
                    </p>
                </div>
            )}

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
                        !bulkCategory ||
                        !bulkDate
                    }
                >
                    {bulkIsSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Import {parseResult?.detectedCount || 0} Transaksi
                </Button>
            </DialogFooter>
        </div>
    );

    // -------------------------------------------------------------------------
    // Dialog Render
    // -------------------------------------------------------------------------
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
            <DialogContent className="sm:max-w-[540px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {isFromAI ? (
                            <Sparkles className="h-5 w-5 text-amber-500" />
                        ) : (
                            <DollarSign className="h-5 w-5" />
                        )}
                        {isFromAI ? 'Konfirmasi Transaksi AI' : 'Tambah Transaksi'}
                    </DialogTitle>
                    <DialogDescription>
                        {isFromAI
                            ? 'Data berikut diekstrak oleh AI. Silakan periksa dan edit jika perlu.'
                            : 'Catat transaksi baru. Pilih mode single atau bulk import.'}
                    </DialogDescription>
                </DialogHeader>

                {isFromAI ? (
                    // AI mode: single form only
                    singleForm
                ) : (
                    // Normal mode: tabs for single or bulk
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
        </Dialog>
    );
}
