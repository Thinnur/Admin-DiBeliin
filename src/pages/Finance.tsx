// =============================================================================
// DiBeliin Admin - Finance Page
// =============================================================================
// Premium financial dashboard with KPI cards and transaction history

import { useState, useRef } from 'react';
import { format } from 'date-fns';
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Trash2,
    ArrowUpRight,
    ArrowDownRight,
    Receipt,
    CreditCard,
    Camera,
    Loader2,
    Plus,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { DataTable } from '@/components/ui/data-table';
import { AddTransactionDialog } from '@/components/finance/AddTransactionDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import {
    useTransactions,
    useFinancialSummary,
    useDeleteTransaction,
} from '@/hooks/useFinance';
import { analyzeReceipt, type ReceiptAnalysisResult } from '@/services/aiService';
import type { Transaction, TransactionType } from '@/types/database';

// -----------------------------------------------------------------------------
// Currency Formatter
// -----------------------------------------------------------------------------

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

// Compact format helper (available for future use)
// const formatCompact = (amount: number) => {
//     if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)}jt`;
//     if (amount >= 1000) return `Rp ${(amount / 1000).toFixed(0)}rb`;
//     return `Rp ${amount}`;
// };

// -----------------------------------------------------------------------------
// KPI Card Component
// -----------------------------------------------------------------------------

interface KPICardProps {
    title: string;
    value: number;
    icon: React.ReactNode;
    iconBg: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    isLoading?: boolean;
}

function KPICard({
    title,
    value,
    icon,
    iconBg,
    trend,
    isLoading,
}: KPICardProps) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all duration-200 hover-lift">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    {isLoading ? (
                        <Skeleton className="h-10 w-36 mt-2" />
                    ) : (
                        <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">
                            {formatCurrency(value)}
                        </p>
                    )}

                    {/* Trend Indicator */}
                    {trend && !isLoading && (
                        <div className="flex items-center gap-1.5 mt-3">
                            <div
                                className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${trend.isPositive
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-red-50 text-red-600'
                                    }`}
                            >
                                {trend.isPositive ? (
                                    <ArrowUpRight className="h-3 w-3" />
                                ) : (
                                    <ArrowDownRight className="h-3 w-3" />
                                )}
                                <span>{trend.value}%</span>
                            </div>
                            <span className="text-xs text-slate-400">vs last month</span>
                        </div>
                    )}
                </div>

                {/* Icon */}
                <div className={`p-3 rounded-xl ${iconBg}`}>{icon}</div>
            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Category Labels
// -----------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
    penjualan: 'Penjualan',
    jasa: 'Jasa',
    lain: 'Lainnya',
    beli_akun: 'Beli Akun',
    server: 'Server',
    operasional: 'Operasional',
    marketing: 'Marketing',
};

// -----------------------------------------------------------------------------
// Table Columns
// -----------------------------------------------------------------------------

function getTransactionColumns(
    onDelete: (id: string) => void
): ColumnDef<Transaction>[] {
    return [
        {
            accessorKey: 'created_at',
            header: 'Date',
            cell: ({ row }) => {
                const date = new Date(row.getValue('created_at'));
                return (
                    <div className="text-sm">
                        <div className="font-medium text-slate-900 tabular-nums">
                            {format(date, 'dd MMM yyyy')}
                        </div>
                        <div className="text-slate-400 text-xs tabular-nums">
                            {format(date, 'HH:mm')}
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: 'transaction_type',
            header: 'Type',
            cell: ({ row }) => {
                const type = row.getValue('transaction_type') as TransactionType;
                return (
                    <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${type === 'income'
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10'
                            : 'bg-red-50 text-red-700 ring-1 ring-red-600/10'
                            }`}
                    >
                        {type === 'income' ? (
                            <TrendingUp className="h-3 w-3" />
                        ) : (
                            <TrendingDown className="h-3 w-3" />
                        )}
                        {type === 'income' ? 'Income' : 'Expense'}
                    </div>
                );
            },
        },
        {
            accessorKey: 'category',
            header: 'Category',
            cell: ({ row }) => {
                const category = row.getValue('category') as string;
                return (
                    <span className="text-sm font-medium text-slate-700">
                        {CATEGORY_LABELS[category] || category || '-'}
                    </span>
                );
            },
        },
        {
            accessorKey: 'description',
            header: 'Description',
            cell: ({ row }) => {
                const description = row.getValue('description') as string | null;
                return (
                    <span className="text-sm text-slate-500 max-w-[200px] truncate block">
                        {description || '-'}
                    </span>
                );
            },
        },
        {
            accessorKey: 'amount',
            header: () => <div className="text-right">Amount</div>,
            cell: ({ row }) => {
                const amount = row.getValue('amount') as number;
                const type = row.original.transaction_type;
                return (
                    <div
                        className={`text-right font-bold tabular-nums ${type === 'income' ? 'text-emerald-600' : 'text-red-600'
                            }`}
                    >
                        {type === 'income' ? '+' : '-'}
                        {formatCurrency(amount)}
                    </div>
                );
            },
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                const transaction = row.original;
                return (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500 transition-colors" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete this{' '}
                                    {transaction.transaction_type} of{' '}
                                    <strong>{formatCurrency(transaction.amount)}</strong>. This
                                    action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => onDelete(transaction.id)}
                                    className="bg-red-500 hover:bg-red-600"
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                );
            },
        },
    ];
}

// -----------------------------------------------------------------------------
// Finance Page Component
// -----------------------------------------------------------------------------

export default function FinancePage() {
    const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');

    // AI Scanning State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiResult, setAiResult] = useState<ReceiptAnalysisResult | null>(null);
    const [aiDialogOpen, setAiDialogOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // FAB Dialog State (for mobile)
    const [fabDialogOpen, setFabDialogOpen] = useState(false);

    // Queries
    const { data: transactions = [], isLoading: transactionsLoading } =
        useTransactions(typeFilter === 'all' ? undefined : { type: typeFilter });
    const { data: summary, isLoading: summaryLoading } = useFinancialSummary();
    const deleteTransaction = useDeleteTransaction();

    // Handlers
    const handleDelete = (id: string) => {
        deleteTransaction.mutate(id);
    };

    const handleScanClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset file input for re-selection
        e.target.value = '';

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Pilih file gambar (PNG, JPG, dll)');
            return;
        }

        setIsAnalyzing(true);
        try {
            const result = await analyzeReceipt(file);
            setAiResult(result);
            setAiDialogOpen(true);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
            toast.error(message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAiDialogClose = (open: boolean) => {
        setAiDialogOpen(open);
        if (!open) {
            setAiResult(null);
        }
    };

    const columns = getTransactionColumns(handleDelete);

    return (
        <div className="space-y-6">
            {/* Hidden File Input for AI Scanning */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KPICard
                    title="Total Income"
                    value={summary?.total_income || 0}
                    icon={<Wallet className="h-6 w-6 text-emerald-600" />}
                    iconBg="bg-emerald-50"
                    trend={{ value: 12, isPositive: true }}
                    isLoading={summaryLoading}
                />
                <KPICard
                    title="Total Expense"
                    value={summary?.total_expense || 0}
                    icon={<CreditCard className="h-6 w-6 text-red-500" />}
                    iconBg="bg-red-50"
                    trend={{ value: 8, isPositive: false }}
                    isLoading={summaryLoading}
                />
                <KPICard
                    title="Net Profit"
                    value={summary?.net_profit || 0}
                    icon={<Receipt className="h-6 w-6 text-amber-600" />}
                    iconBg="bg-amber-50"
                    trend={{
                        value: 18,
                        isPositive: (summary?.net_profit || 0) >= 0,
                    }}
                    isLoading={summaryLoading}
                />
            </div>

            {/* Transaction Table Card */}
            <Card className="shadow-sm">
                <CardHeader className="border-b border-slate-100 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg">Transaction History</CardTitle>
                            <CardDescription>Recent financial activities</CardDescription>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Filter */}
                            <select
                                value={typeFilter}
                                onChange={(e) =>
                                    setTypeFilter(e.target.value as TransactionType | 'all')
                                }
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                            >
                                <option value="all">All Transactions</option>
                                <option value="income">Income Only</option>
                                <option value="expense">Expense Only</option>
                            </select>

                            {/* Scan Button */}
                            <Button
                                variant="outline"
                                onClick={handleScanClick}
                                disabled={isAnalyzing}
                                className="gap-2"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Camera className="h-4 w-4" />
                                        Scan Bukti (AI)
                                    </>
                                )}
                            </Button>

                            {/* Desktop Add Transaction Button - Hidden on Mobile */}
                            <div className="hidden md:flex">
                                <AddTransactionDialog />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="overflow-x-auto">
                        <DataTable
                            columns={columns}
                            data={transactions}
                            isLoading={transactionsLoading}
                            emptyMessage="No transactions found. Add your first transaction!"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* AI Confirmation Dialog */}
            {aiResult && (
                <AddTransactionDialog
                    open={aiDialogOpen}
                    onOpenChange={handleAiDialogClose}
                    initialData={aiResult}
                    isFromAI={true}
                    trigger={null}
                />
            )}

            {/* Mobile FAB for Add Transaction */}
            <button
                onClick={() => setFabDialogOpen(true)}
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl bg-primary text-primary-foreground flex items-center justify-center z-50 md:hidden hover:bg-primary/90 transition-colors"
                aria-label="Add Transaction"
            >
                <Plus className="h-6 w-6" />
            </button>

            {/* FAB Dialog */}
            <AddTransactionDialog
                open={fabDialogOpen}
                onOpenChange={setFabDialogOpen}
                trigger={null}
            />
        </div>
    );
}
