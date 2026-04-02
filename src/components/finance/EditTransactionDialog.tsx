import { useMemo, useState } from 'react';
import { Loader2, PencilLine } from 'lucide-react';

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
import { useTransactionCategories, useUpdateTransaction } from '@/hooks/useFinance';
import { getCategorySuggestions, normalizeCategoryValue } from '@/lib/financeCategories';
import { TransactionCategoryInput } from '@/components/finance/TransactionCategoryInput';
import type { Transaction } from '@/types/database';

interface EditTransactionDialogProps {
    transaction: Transaction;
    trigger?: React.ReactNode;
}

export function EditTransactionDialog({
    transaction,
    trigger,
}: EditTransactionDialogProps) {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState(String(transaction.amount));
    const [category, setCategory] = useState(transaction.category);
    const [description, setDescription] = useState(transaction.description ?? '');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const updateTransaction = useUpdateTransaction();
    const { data: categoryGroups } = useTransactionCategories();

    const suggestions = useMemo(
        () => getCategorySuggestions(transaction.transaction_type, categoryGroups),
        [transaction.transaction_type, categoryGroups]
    );

    const handleOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            setAmount(String(transaction.amount));
            setCategory(transaction.category);
            setDescription(transaction.description ?? '');
            setErrors({});
        }

        setOpen(nextOpen);
    };

    const validate = () => {
        const nextErrors: Record<string, string> = {};

        if (!amount || Number(amount) <= 0) {
            nextErrors.amount = 'Amount must be greater than 0';
        }

        if (!normalizeCategoryValue(category)) {
            nextErrors.category = 'Please enter a category';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!validate()) return;

        try {
            await updateTransaction.mutateAsync({
                id: transaction.id,
                updates: {
                    amount: Number(amount),
                    category: normalizeCategoryValue(category),
                    description: description.trim(),
                },
            });
            setOpen(false);
        } catch {
            // Toast handled in hook.
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="outline" size="sm" className="gap-2">
                        <PencilLine className="h-4 w-4" />
                        Edit
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle>Edit Transaction</DialogTitle>
                    <DialogDescription>
                        Update nominal, kategori, atau keterangan transaksi ini.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor={`edit-amount-${transaction.id}`}>Amount (Rp)</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                Rp
                            </span>
                            <Input
                                id={`edit-amount-${transaction.id}`}
                                type="number"
                                value={amount}
                                onChange={(event) => setAmount(event.target.value)}
                                className={`pl-10 ${errors.amount ? 'border-red-500' : ''}`}
                            />
                        </div>
                        {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor={`edit-category-${transaction.id}`}>Category</Label>
                        <TransactionCategoryInput
                            id={`edit-category-${transaction.id}`}
                            value={category}
                            onChange={setCategory}
                            suggestions={suggestions}
                            className={errors.category ? 'border-red-500' : ''}
                        />
                        {errors.category && (
                            <p className="text-xs text-red-500">{errors.category}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor={`edit-description-${transaction.id}`}>Description</Label>
                        <Input
                            id={`edit-description-${transaction.id}`}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="Tambahkan keterangan transaksi"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={updateTransaction.isPending}>
                            {updateTransaction.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
