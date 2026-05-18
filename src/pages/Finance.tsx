// =============================================================================
// DiBeliin Admin - Finance Page
// =============================================================================
// Premium financial dashboard with KPI cards, period filtering, and profit comparison

import { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    format,
    startOfDay,
    endOfDay,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    subDays,
    subMonths,
    addDays,
    addMonths,
    differenceInDays,
} from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Trash2,
    PencilLine,
    ArrowUpRight,
    ArrowDownRight,
    Receipt,
    CreditCard,
    Camera,
    Loader2,
    Plus,
    ChevronLeft,
    ChevronRight,
    Calendar,
    CalendarDays,
    CalendarRange,
    Landmark,
    Search,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { DataTable } from '@/components/ui/data-table';
import { AddTransactionDialog } from '@/components/finance/AddTransactionDialog';
import { EditTransactionDialog } from '@/components/finance/EditTransactionDialog';
import { ImportBankJagoDialog } from '@/components/finance/ImportBankJagoDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    useTransactionCategories,
    useFinancialSummary,
    useDeleteTransaction,
    useProfitComparison,
} from '@/hooks/useFinance';
import {
    formatCategoryLabel,
    getAllCategorySuggestions,
} from '@/lib/financeCategories';
import { analyzeReceipt, type ReceiptAnalysisResult } from '@/services/aiService';
import type { Transaction, TransactionType } from '@/types/database';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type PeriodMode = 'daily' | 'monthly' | 'range' | 'all_time';

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

// -----------------------------------------------------------------------------
// KPI Card Component
// -----------------------------------------------------------------------------

interface KPICardProps {
    title: string;
    value: number;
    icon: React.ReactNode;
    iconBg: string;
    isLoading?: boolean;
}

function KPICard({
    title,
    value,
    icon,
    iconBg,
    isLoading,
}: KPICardProps) {
    return (
        <div className="bg-white rounded-xl md:rounded-2xl border border-slate-200 p-3 md:p-6 shadow-sm hover:shadow-md transition-all duration-200 hover-lift">
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium text-slate-500 truncate">{title}</p>
                    {isLoading ? (
                        <Skeleton className="h-7 md:h-10 w-24 md:w-36 mt-1 md:mt-2" />
                    ) : (
                        <p className="text-base md:text-3xl font-bold text-slate-900 mt-1 md:mt-2 tabular-nums">
                            {formatCurrency(value)}
                        </p>
                    )}
                </div>

                {/* Icon */}
                <div className={`p-2 md:p-3 rounded-lg md:rounded-xl ${iconBg}`}>{icon}</div>
            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Profit Comparison Card
// -----------------------------------------------------------------------------

interface ProfitComparisonCardProps {
    currentProfit: number;
    previousProfit: number;
    diff: number;
    percentage: number;
    isPositive: boolean;
    currentLabel: string;
    previousLabel: string;
    isLoading: boolean;
}

function ProfitComparisonCard({
    currentProfit,
    previousProfit,
    diff,
    percentage,
    isPositive,
    currentLabel,
    previousLabel,
    isLoading,
}: ProfitComparisonCardProps) {
    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl md:rounded-2xl p-3 md:p-6 shadow-lg text-white">
            <div className="flex items-center gap-2 mb-2 md:mb-3">
                <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-400" />
                <h3 className="text-xs md:text-sm font-semibold text-slate-300">Perbandingan Keuntungan</h3>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-6 w-28 bg-slate-700" />
                    <Skeleton className="h-4 w-40 bg-slate-700" />
                </div>
            ) : (
                <>
                    {/* Diff highlight */}
                    <div className="flex items-center gap-2 md:gap-3 mb-2.5 md:mb-4">
                        <div
                            className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm font-bold ${isPositive
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                                }`}
                        >
                            {isPositive ? (
                                <ArrowUpRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            ) : (
                                <ArrowDownRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            )}
                            <span>{isPositive ? '+' : ''}{percentage}%</span>
                        </div>
                        <span className="text-xs md:text-sm text-slate-400">
                            {isPositive ? '+' : ''}{formatCurrency(diff)}
                        </span>
                    </div>

                    {/* Period details */}
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                        <div className="bg-white/5 rounded-lg p-2 md:p-3">
                            <p className="text-[10px] md:text-xs text-slate-400 mb-0.5 md:mb-1">{currentLabel}</p>
                            <p className={`text-xs md:text-lg font-bold tabular-nums ${currentProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                {formatCurrency(currentProfit)}
                            </p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 md:p-3">
                            <p className="text-[10px] md:text-xs text-slate-400 mb-0.5 md:mb-1">{previousLabel}</p>
                            <p className={`text-xs md:text-lg font-bold tabular-nums ${previousProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                {formatCurrency(previousProfit)}
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// -----------------------------------------------------------------------------
// Financial Trend Chart
// -----------------------------------------------------------------------------

interface FinancialTrendPoint {
    label: string;
    fullLabel: string;
    income: number;
    expense: number;
    profit: number;
}

interface FinancialTrendChartProps {
    data: FinancialTrendPoint[];
    isLoading: boolean;
}

function FinancialTrendChart({
    data,
    isLoading,
}: FinancialTrendChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const element = chartContainerRef.current;
        if (!element) return;

        const updateWidth = () => {
            setContainerWidth(element.clientWidth);
        };

        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    const formatCompactAmount = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            notation: 'compact',
            compactDisplay: 'short',
            maximumFractionDigits: 1,
        }).format(amount);
    };

    if (isLoading) {
        return (
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base md:text-lg">Grafik Tren Keuangan</CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                        Income, expense, dan profit per hari
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Skeleton className="h-56 w-full" />
                    <div className="flex gap-3">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (data.length === 0) {
        return (
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base md:text-lg">Grafik Tren Keuangan</CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                        Income, expense, dan profit per hari
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-slate-500">Belum ada data transaksi pada periode ini.</p>
                </CardContent>
            </Card>
        );
    }

    const allValues = data.flatMap((point) => [point.income, point.expense, point.profit]);
    const minValue = Math.min(0, ...allValues);
    const maxValue = Math.max(0, ...allValues);
    const valueRange = Math.max(1, maxValue - minValue);

    const chartHeight = 220;
    const padding = { top: 16, right: 20, bottom: 34, left: 48 };
    const pointCount = data.length;
    const stepWidth = pointCount > 2000
        ? 2
        : pointCount > 1000
            ? 4
            : pointCount > 365
                ? 8
                : pointCount > 180
                    ? 12
                : pointCount > 90
                    ? 20
                    : 46;
    const minDataWidth =
        padding.left + padding.right + Math.max(0, pointCount - 1) * stepWidth;
    const chartWidth = Math.max(containerWidth || 640, minDataWidth);
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;

    const getX = (index: number) => {
        if (pointCount <= 1) {
            return padding.left + plotWidth / 2;
        }
        return padding.left + (index / (pointCount - 1)) * plotWidth;
    };
    const getY = (value: number) =>
        padding.top + ((maxValue - value) / valueRange) * plotHeight;

    const buildPath = (series: 'income' | 'expense' | 'profit') => {
        return data
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point[series])}`)
            .join(' ');
    };

    const yTicks = 5;
    const tickValues = Array.from({ length: yTicks }, (_, index) => {
        const ratio = index / (yTicks - 1);
        return maxValue - ratio * valueRange;
    });

    const xLabelInterval =
        pointCount <= 10 ? 1 : pointCount <= 20 ? 2 : Math.ceil(pointCount / 10);

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">Grafik Tren Keuangan</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                    Income, expense, dan profit per hari
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div ref={chartContainerRef} className="overflow-x-auto">
                    <svg
                        width={chartWidth}
                        height={chartHeight}
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                        className="block"
                    >
                        {tickValues.map((value, index) => {
                            const y = getY(value);
                            return (
                                <g key={`tick-${index}`}>
                                    <line
                                        x1={padding.left}
                                        y1={y}
                                        x2={chartWidth - padding.right}
                                        y2={y}
                                        stroke="#e2e8f0"
                                        strokeDasharray="3 3"
                                    />
                                    <text
                                        x={padding.left - 8}
                                        y={y + 4}
                                        textAnchor="end"
                                        fontSize="10"
                                        fill="#64748b"
                                    >
                                        {formatCompactAmount(value)}
                                    </text>
                                </g>
                            );
                        })}

                        <line
                            x1={padding.left}
                            y1={getY(0)}
                            x2={chartWidth - padding.right}
                            y2={getY(0)}
                            stroke="#94a3b8"
                            strokeWidth="1.3"
                        />

                        <path
                            d={buildPath('income')}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                        <path
                            d={buildPath('expense')}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                        <path
                            d={buildPath('profit')}
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />

                        {data.map((point, index) => (
                            <g key={`x-label-${point.fullLabel}`}>
                                {(index === 0 || index === pointCount - 1 || index % xLabelInterval === 0) && (
                                    <text
                                        x={getX(index)}
                                        y={chartHeight - 10}
                                        textAnchor="middle"
                                        fontSize="10"
                                        fill="#64748b"
                                    >
                                        {point.label}
                                    </text>
                                )}
                            </g>
                        ))}
                    </svg>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <div className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        Income
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                        Expense
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        Profit
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// -----------------------------------------------------------------------------
// Period Selector Component
// -----------------------------------------------------------------------------

interface PeriodSelectorProps {
    mode: PeriodMode;
    selectedDate: Date;
    rangeStart: Date;
    rangeEnd: Date;
    onModeChange: (mode: PeriodMode) => void;
    onDateChange: (date: Date) => void;
    onRangeStartChange: (date: Date) => void;
    onRangeEndChange: (date: Date) => void;
}

function PeriodSelector({
    mode,
    selectedDate,
    rangeStart,
    rangeEnd,
    onModeChange,
    onDateChange,
    onRangeStartChange,
    onRangeEndChange,
}: PeriodSelectorProps) {
    const handlePrev = () => {
        onDateChange(mode === 'daily' ? subDays(selectedDate, 1) : subMonths(selectedDate, 1));
    };
    const handleNext = () => {
        const next = mode === 'daily' ? addDays(selectedDate, 1) : addMonths(selectedDate, 1);
        if (next <= new Date()) {
            onDateChange(next);
        }
    };

    const dateLabel =
        mode === 'daily'
            ? format(selectedDate, 'dd MMMM yyyy', { locale: localeID })
            : format(selectedDate, 'MMMM yyyy', { locale: localeID });

    return (
        <div className="space-y-2">
            {/* Row 1: Mode toggle + date nav inline */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Mode toggle */}
                <div className="inline-flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                    <button
                        onClick={() => onModeChange('daily')}
                        className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${mode === 'daily'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        Harian
                    </button>
                    <button
                        onClick={() => onModeChange('monthly')}
                        className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${mode === 'monthly'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <CalendarDays className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        Bulanan
                    </button>
                    <button
                        onClick={() => onModeChange('range')}
                        className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${mode === 'range'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <CalendarRange className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        Rentang
                    </button>
                    <button
                        onClick={() => onModeChange('all_time')}
                        className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${mode === 'all_time'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Semua Waktu
                    </button>
                </div>

                {/* Date navigator (daily/monthly) - hidden in range and all_time mode */}
                {mode !== 'range' && mode !== 'all_time' && (
                    <div className="inline-flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg px-0.5 py-0.5">
                        <button
                            onClick={handlePrev}
                            className="p-1 md:p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                            title="Sebelumnya"
                        >
                            <ChevronLeft className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-500" />
                        </button>
                        <span className="text-xs md:text-sm font-medium text-slate-700 min-w-[110px] md:min-w-[140px] text-center tabular-nums">
                            {dateLabel}
                        </span>
                        <button
                            onClick={handleNext}
                            className="p-1 md:p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                            title="Berikutnya"
                        >
                            <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-500" />
                        </button>
                    </div>
                )}
            </div>

            {/* Date range pickers (range mode only) - hidden in all_time */}
            {mode === 'range' && (
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 font-medium">Dari</span>
                        <input
                            type="date"
                            value={format(rangeStart, 'yyyy-MM-dd')}
                            onChange={(e) => {
                                const d = new Date(e.target.value + 'T00:00:00');
                                if (!isNaN(d.getTime())) onRangeStartChange(d);
                            }}
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 font-medium">Sampai</span>
                        <input
                            type="date"
                            value={format(rangeEnd, 'yyyy-MM-dd')}
                            onChange={(e) => {
                                const d = new Date(e.target.value + 'T00:00:00');
                                if (!isNaN(d.getTime())) onRangeEndChange(d);
                            }}
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

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
                        {formatCategoryLabel(category)}
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
                    <div className="flex items-center justify-end gap-1">
                        <EditTransactionDialog
                            transaction={transaction}
                            trigger={
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-slate-100"
                                >
                                    <PencilLine className="h-4 w-4 text-slate-400 hover:text-slate-700 transition-colors" />
                                </Button>
                            }
                        />
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
                    </div>
                );
            },
        },
    ];
}

// -----------------------------------------------------------------------------
// Finance Page Component
// -----------------------------------------------------------------------------

export default function FinancePage() {
    // Period state
    const [periodMode, setPeriodMode] = useState<PeriodMode>('daily');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [rangeStart, setRangeStart] = useState<Date>(subDays(new Date(), 6)); // default: last 7 days
    const [rangeEnd, setRangeEnd] = useState<Date>(new Date());

    const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // AI Scanning State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiResult, setAiResult] = useState<ReceiptAnalysisResult | null>(null);
    const [aiDialogOpen, setAiDialogOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Import Bank Jago State
    const [importDialogOpen, setImportDialogOpen] = useState(false);

    // FAB Dialog State (for mobile)
    const [fabDialogOpen, setFabDialogOpen] = useState(false);

    // -------------------------------------------------------------------------
    // Compute date ranges
    // -------------------------------------------------------------------------

    const { currentRange, previousRange, currentLabel, previousLabel } = useMemo(() => {
        if (periodMode === 'daily') {
            const dayStart = startOfDay(selectedDate).toISOString();
            const dayEnd = endOfDay(selectedDate).toISOString();

            const yesterday = subDays(selectedDate, 1);
            const prevStart = startOfDay(yesterday).toISOString();
            const prevEnd = endOfDay(yesterday).toISOString();

            return {
                currentRange: { startDate: dayStart, endDate: dayEnd },
                previousRange: { startDate: prevStart, endDate: prevEnd },
                currentLabel: format(selectedDate, 'dd MMM', { locale: localeID }),
                previousLabel: format(yesterday, 'dd MMM', { locale: localeID }),
            };
        } else if (periodMode === 'monthly') {
            const monthStart = startOfMonth(selectedDate).toISOString();
            const monthEnd = endOfMonth(selectedDate).toISOString();

            const lastMonth = subMonths(selectedDate, 1);
            const prevStart = startOfMonth(lastMonth).toISOString();
            const prevEnd = endOfMonth(lastMonth).toISOString();

            return {
                currentRange: { startDate: monthStart, endDate: monthEnd },
                previousRange: { startDate: prevStart, endDate: prevEnd },
                currentLabel: format(selectedDate, 'MMM yy', { locale: localeID }),
                previousLabel: format(lastMonth, 'MMM yy', { locale: localeID }),
            };
        } else if (periodMode === 'all_time') {
            // All time: no date filter
            return {
                currentRange: { startDate: undefined, endDate: undefined },
                previousRange: { startDate: undefined, endDate: undefined },
                currentLabel: 'Semua Waktu',
                previousLabel: '-',
            };
        } else {
            // Range mode: custom from-to
            const [normalizedStart, normalizedEnd] =
                rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
            const rStart = startOfDay(normalizedStart).toISOString();
            const rEnd = endOfDay(normalizedEnd).toISOString();

            // Previous period = same duration right before normalizedStart
            const days = differenceInDays(normalizedEnd, normalizedStart) + 1;
            const prevEnd = subDays(normalizedStart, 1);
            const prevStart = subDays(normalizedStart, days);

            return {
                currentRange: { startDate: rStart, endDate: rEnd },
                previousRange: { startDate: startOfDay(prevStart).toISOString(), endDate: endOfDay(prevEnd).toISOString() },
                currentLabel: `${format(normalizedStart, 'dd MMM', { locale: localeID })} - ${format(normalizedEnd, 'dd MMM', { locale: localeID })}`,
                previousLabel: `${format(prevStart, 'dd MMM', { locale: localeID })} - ${format(prevEnd, 'dd MMM', { locale: localeID })}`,
            };
        }
    }, [periodMode, selectedDate, rangeStart, rangeEnd]);

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    const transactionFilters = useMemo(() => ({
        startDate: currentRange.startDate,
        endDate: currentRange.endDate,
    }), [currentRange]);

    const { data: transactions = [], isLoading: transactionsLoading } =
        useTransactions(transactionFilters);
    const { data: categoryGroups } = useTransactionCategories();
    const { data: summary, isLoading: summaryLoading } = useFinancialSummary(currentRange);
    const { data: comparison, isLoading: comparisonLoading } = useProfitComparison(
        currentRange,
        previousRange,
    );
    const deleteTransaction = useDeleteTransaction();

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

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

    const categoryOptions = useMemo(
        () => getAllCategorySuggestions(categoryGroups),
        [categoryGroups]
    );

    const filteredTransactions = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLowerCase();
        const searchDigits = searchQuery.replace(/\D/g, '');

        return transactions.filter((transaction) => {
            if (typeFilter !== 'all' && transaction.transaction_type !== typeFilter) {
                return false;
            }

            if (categoryFilter !== 'all' && transaction.category !== categoryFilter) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            const description = (transaction.description ?? '').toLowerCase();
            const categoryLabel = formatCategoryLabel(transaction.category).toLowerCase();
            const rawCategory = (transaction.category ?? '').toLowerCase();
            const amountText = String(transaction.amount);
            const amountDigits = amountText.replace(/\D/g, '');

            return (
                description.includes(normalizedSearch) ||
                categoryLabel.includes(normalizedSearch) ||
                rawCategory.includes(normalizedSearch) ||
                (!!searchDigits && amountDigits.includes(searchDigits))
            );
        });
    }, [transactions, typeFilter, categoryFilter, searchQuery]);

    const isFiltered = useMemo(
        () => typeFilter !== 'all' || categoryFilter !== 'all' || searchQuery.trim() !== '',
        [typeFilter, categoryFilter, searchQuery]
    );

    const filteredSummary = useMemo(() => {
        if (!isFiltered) return null;
        return filteredTransactions.reduce(
            (acc, t) => {
                if (t.transaction_type === 'income') acc.income += t.amount;
                else acc.expense += t.amount;
                return acc;
            },
            { income: 0, expense: 0 }
        );
    }, [isFiltered, filteredTransactions]);

    const normalizedRange = useMemo(() => {
        const [start, end] = rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
        return { start, end };
    }, [rangeStart, rangeEnd]);

    const trendData = useMemo<FinancialTrendPoint[]>(() => {
        if (periodMode === 'daily') {
            return [];
        }

        let earliestDateMs: number | null = null;
        let latestDateMs: number | null = null;
        for (const transaction of transactions) {
            const timestamp = new Date(transaction.created_at).getTime();
            if (Number.isNaN(timestamp)) continue;
            if (earliestDateMs === null || timestamp < earliestDateMs) earliestDateMs = timestamp;
            if (latestDateMs === null || timestamp > latestDateMs) latestDateMs = timestamp;
        }

        const periodStart =
            periodMode === 'monthly'
                ? startOfMonth(selectedDate)
                : periodMode === 'range'
                    ? startOfDay(normalizedRange.start)
                    : earliestDateMs !== null
                        ? startOfDay(new Date(earliestDateMs))
                        : null;

        const periodEnd =
            periodMode === 'monthly'
                ? endOfMonth(selectedDate)
                : periodMode === 'range'
                    ? endOfDay(normalizedRange.end)
                    : latestDateMs !== null
                        ? endOfDay(new Date(latestDateMs))
                        : null;

        if (!periodStart || !periodEnd) {
            return [];
        }

        const pointsByDay = new Map<string, FinancialTrendPoint>();
        const periodDays = eachDayOfInterval({ start: periodStart, end: periodEnd });

        for (const day of periodDays) {
            const key = format(day, 'yyyy-MM-dd');
            pointsByDay.set(key, {
                label: periodMode === 'monthly'
                    ? format(day, 'dd')
                    : format(day, 'dd MMM', { locale: localeID }),
                fullLabel: format(day, 'dd MMM yyyy', { locale: localeID }),
                income: 0,
                expense: 0,
                profit: 0,
            });
        }

        for (const transaction of transactions) {
            const key = format(new Date(transaction.created_at), 'yyyy-MM-dd');
            const point = pointsByDay.get(key);
            if (!point) continue;

            if (transaction.transaction_type === 'income') {
                point.income += transaction.amount;
            } else {
                point.expense += transaction.amount;
            }
            point.profit = point.income - point.expense;
        }

        return periodDays.map((day) => pointsByDay.get(format(day, 'yyyy-MM-dd'))!);
    }, [transactions, periodMode, selectedDate, normalizedRange]);

    const columns = getTransactionColumns(handleDelete);

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Hidden File Input for AI Scanning */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
            />

            {/* Period Selector */}
            <PeriodSelector
                mode={periodMode}
                selectedDate={selectedDate}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onModeChange={setPeriodMode}
                onDateChange={setSelectedDate}
                onRangeStartChange={setRangeStart}
                onRangeEndChange={setRangeEnd}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
                <KPICard
                    title="Total Income"
                    value={summary?.total_income || 0}
                    icon={<Wallet className="h-5 w-5 md:h-6 md:w-6 text-emerald-600" />}
                    iconBg="bg-emerald-50"
                    isLoading={summaryLoading}
                />
                <KPICard
                    title="Total Expense"
                    value={summary?.total_expense || 0}
                    icon={<CreditCard className="h-5 w-5 md:h-6 md:w-6 text-red-500" />}
                    iconBg="bg-red-50"
                    isLoading={summaryLoading}
                />
                <div className="col-span-2 md:col-span-1">
                    <KPICard
                        title="Net Profit"
                        value={summary?.net_profit || 0}
                        icon={<Receipt className="h-5 w-5 md:h-6 md:w-6 text-amber-600" />}
                        iconBg="bg-amber-50"
                        isLoading={summaryLoading}
                    />
                </div>
            </div>

            {/* Financial Trend Chart */}
            {periodMode !== 'daily' && (
                <FinancialTrendChart
                    data={trendData}
                    isLoading={transactionsLoading}
                />
            )}

            {/* Profit Comparison Card */}
            <ProfitComparisonCard
                currentProfit={comparison?.current.net_profit || 0}
                previousProfit={comparison?.previous.net_profit || 0}
                diff={comparison?.profitDiff || 0}
                percentage={comparison?.profitPercentage || 0}
                isPositive={comparison?.isPositive ?? true}
                currentLabel={currentLabel}
                previousLabel={previousLabel}
                isLoading={comparisonLoading}
            />

            {/* Transaction Table Card */}
            <Card className="shadow-sm">
                <CardHeader className="border-b border-slate-100 pb-3 md:pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
                        <div>
                            <CardTitle className="text-base md:text-lg">Transaction History</CardTitle>
                            <CardDescription className="text-xs md:text-sm">
                                {periodMode === 'daily'
                                    ? format(selectedDate, 'dd MMMM yyyy', { locale: localeID })
                                    : periodMode === 'monthly'
                                        ? format(selectedDate, 'MMMM yyyy', { locale: localeID })
                                        : periodMode === 'all_time'
                                            ? 'Semua transaksi'
                                            : `${format(normalizedRange.start, 'dd MMM yyyy', { locale: localeID })} - ${format(normalizedRange.end, 'dd MMM yyyy', { locale: localeID })}`}
                            </CardDescription>
                        </div>

                        <div className="flex items-center gap-2 md:gap-3">
                            {/* Scan Button */}
                            <Button
                                variant="outline"
                                onClick={handleScanClick}
                                disabled={isAnalyzing}
                                className="gap-1.5 md:gap-2 text-xs md:text-sm h-7 md:h-9 px-2.5 md:px-4"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Camera className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                        Scan Bukti (AI)
                                    </>
                                )}
                            </Button>

                            {/* Import Bank Jago Button */}
                            <Button
                                variant="outline"
                                onClick={() => setImportDialogOpen(true)}
                                className="gap-1.5 md:gap-2 text-xs md:text-sm h-7 md:h-9 px-2.5 md:px-4 border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                                <Landmark className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                Import Bank Jago
                            </Button>

                            {/* Desktop Add Transaction Button - Hidden on Mobile */}
                            <div className="hidden md:flex">
                                <AddTransactionDialog />
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-col lg:flex-row lg:items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Cari nominal atau keterangan transaksi"
                                className="pl-9"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:w-[420px]">
                            <select
                                value={typeFilter}
                                onChange={(event) =>
                                    setTypeFilter(event.target.value as TransactionType | 'all')
                                }
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                            >
                                <option value="all">Semua tipe</option>
                                <option value="income">Income</option>
                                <option value="expense">Expense</option>
                            </select>

                            <select
                                value={categoryFilter}
                                onChange={(event) => setCategoryFilter(event.target.value)}
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                            >
                                <option value="all">Semua kategori</option>
                                {categoryOptions.map((category) => (
                                    <option key={category} value={category}>
                                        {formatCategoryLabel(category)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                        Menampilkan {filteredTransactions.length} dari {transactions.length} transaksi
                    </p>
                </CardHeader>
                <CardContent className="pt-4">
                    {filteredSummary && (
                        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            <span className="font-medium text-slate-500">Ringkasan Filter:</span>
                            <span>
                                Income{' '}
                                <span className="font-semibold text-emerald-600">
                                    {formatCurrency(filteredSummary.income)}
                                </span>
                            </span>
                            <span>
                                Expense{' '}
                                <span className="font-semibold text-red-500">
                                    {formatCurrency(filteredSummary.expense)}
                                </span>
                            </span>
                            <span>
                                Profit{' '}
                                <span className={`font-semibold ${filteredSummary.income - filteredSummary.expense >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {formatCurrency(filteredSummary.income - filteredSummary.expense)}
                                </span>
                            </span>
                            <span className="ml-auto text-slate-400">
                                {filteredTransactions.length} transaksi
                            </span>
                        </div>
                    )}

                    {/* Desktop: DataTable */}
                    <div className="hidden md:block overflow-x-auto">
                        <DataTable
                            columns={columns}
                            data={filteredTransactions}
                            isLoading={transactionsLoading}
                            emptyMessage="Tidak ada transaksi yang cocok dengan filter."
                        />
                    </div>

                    {/* Mobile: Card List */}
                    <div className="md:hidden space-y-2">
                        {transactionsLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="p-3 rounded-lg border border-slate-100 animate-pulse">
                                    <div className="flex justify-between mb-2">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-5 w-24" />
                                    </div>
                                    <Skeleton className="h-3 w-32" />
                                </div>
                            ))
                        ) : filteredTransactions.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-8">Tidak ada transaksi yang cocok.</p>
                        ) : (
                            filteredTransactions.map((tx) => (
                                <div
                                    key={tx.id}
                                    className="p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span
                                                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tx.transaction_type === 'income'
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'bg-red-50 text-red-700'
                                                        }`}
                                                >
                                                    {tx.transaction_type === 'income' ? (
                                                        <TrendingUp className="h-3 w-3" />
                                                    ) : (
                                                        <TrendingDown className="h-3 w-3" />
                                                    )}
                                                    {tx.transaction_type === 'income' ? 'Income' : 'Expense'}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {format(new Date(tx.created_at), 'dd MMM yyyy')}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 truncate">
                                                {formatCategoryLabel(tx.category)}
                                                {tx.description ? ` · ${tx.description}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span
                                                className={`text-sm font-bold tabular-nums whitespace-nowrap ${tx.transaction_type === 'income' ? 'text-emerald-600' : 'text-red-600'
                                                    }`}
                                            >
                                                {tx.transaction_type === 'income' ? '+' : '-'}
                                                {formatCurrency(tx.amount)}
                                            </span>

                                            <div className="flex items-center gap-1">
                                                <EditTransactionDialog
                                                    transaction={tx}
                                                    trigger={
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                        >
                                                            <PencilLine className="h-4 w-4 text-slate-400" />
                                                        </Button>
                                                    }
                                                />

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
                                                                {tx.transaction_type} of{' '}
                                                                <strong>{formatCurrency(tx.amount)}</strong>. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(tx.id)}
                                                                className="bg-red-500 hover:bg-red-600"
                                                            >
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
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

            {/* Import Bank Jago Dialog */}
            <ImportBankJagoDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
            />

            {/* Mobile FAB for Add Transaction - rendered via portal to escape transform ancestor */}
            {createPortal(
                <button
                    onClick={() => setFabDialogOpen(true)}
                    className="fixed right-4 bottom-24 h-14 w-14 rounded-full shadow-2xl bg-primary text-primary-foreground flex items-center justify-center z-40 md:hidden hover:bg-primary/90 active:scale-95 transition-all ring-4 ring-primary/20"
                    aria-label="Add Transaction"
                >
                    <Plus className="h-6 w-6" />
                </button>,
                document.body
            )}

            {/* FAB Dialog */}
            <AddTransactionDialog
                open={fabDialogOpen}
                onOpenChange={setFabDialogOpen}
                trigger={null}
            />
        </div>
    );
}

