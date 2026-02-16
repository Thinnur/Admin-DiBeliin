// =============================================================================
// DiBeliin Admin - Finance Hooks
// =============================================================================
// React Query v5 hooks for transaction management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
    fetchTransactions,
    fetchFinancialSummary,
    createTransaction,
    deleteTransaction,
} from '@/services/apiTransactions';
import type { TransactionFilters, SummaryDateRange } from '@/services/apiTransactions';
import type { Transaction, TransactionInsert } from '@/types/database';
import { queryKeys } from '@/lib/queryClient';

// Local type for financial summary (matches API return)
interface FinancialSummary {
    total_income: number;
    total_expense: number;
    net_profit: number;
}

// -----------------------------------------------------------------------------
// Query: Fetch Transactions
// -----------------------------------------------------------------------------

export function useTransactions(
    filters?: TransactionFilters,
    options?: Omit<UseQueryOptions<Transaction[], Error>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: queryKeys.transactions.list(filters as Record<string, unknown> | undefined),
        queryFn: () => fetchTransactions(filters),
        ...options,
    });
}

// -----------------------------------------------------------------------------
// Query: Financial Summary (with optional date range)
// -----------------------------------------------------------------------------

export function useFinancialSummary(
    dateRange?: SummaryDateRange,
    options?: Omit<UseQueryOptions<FinancialSummary, Error>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: queryKeys.transactions.summary(dateRange as Record<string, unknown> | undefined),
        queryFn: () => fetchFinancialSummary(dateRange),
        ...options,
    });
}

// -----------------------------------------------------------------------------
// Query: Profit Comparison (current period vs previous period)
// -----------------------------------------------------------------------------

export interface ProfitComparisonResult {
    current: FinancialSummary;
    previous: FinancialSummary;
    profitDiff: number;        // absolute difference
    profitPercentage: number;  // percentage change
    isPositive: boolean;       // current >= previous
}

export function useProfitComparison(
    currentRange: SummaryDateRange,
    previousRange: SummaryDateRange,
) {
    const currentQuery = useFinancialSummary(currentRange);
    const previousQuery = useFinancialSummary(previousRange);

    const isLoading = currentQuery.isLoading || previousQuery.isLoading;

    let result: ProfitComparisonResult | undefined;
    if (currentQuery.data && previousQuery.data) {
        const currentProfit = currentQuery.data.net_profit;
        const previousProfit = previousQuery.data.net_profit;
        const diff = currentProfit - previousProfit;
        const pct = previousProfit !== 0
            ? Math.round((diff / Math.abs(previousProfit)) * 100)
            : currentProfit > 0 ? 100 : 0;

        result = {
            current: currentQuery.data,
            previous: previousQuery.data,
            profitDiff: diff,
            profitPercentage: pct,
            isPositive: diff >= 0,
        };
    }

    return { data: result, isLoading };
}

// -----------------------------------------------------------------------------
// Mutation: Add Transaction
// -----------------------------------------------------------------------------

export function useAddTransaction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: TransactionInsert) => createTransaction(data),
        onSuccess: () => {
            // Invalidate transactions and summary
            queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
            toast.success('Transaction added successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to add transaction: ${error.message}`);
        },
    });
}

// -----------------------------------------------------------------------------
// Mutation: Delete Transaction
// -----------------------------------------------------------------------------

export function useDeleteTransaction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteTransaction(id),
        onMutate: async (id) => {
            // Cancel outgoing queries
            await queryClient.cancelQueries({ queryKey: queryKeys.transactions.all });

            // Snapshot previous data
            const previousTransactions = queryClient.getQueryData<Transaction[]>(
                queryKeys.transactions.list()
            );

            // Optimistically remove from list
            if (previousTransactions) {
                queryClient.setQueryData<Transaction[]>(
                    queryKeys.transactions.list(),
                    previousTransactions.filter((t) => t.id !== id)
                );
            }

            return { previousTransactions };
        },
        onError: (error, _id, context) => {
            // Rollback on error
            if (context?.previousTransactions) {
                queryClient.setQueryData(
                    queryKeys.transactions.list(),
                    context.previousTransactions
                );
            }
            toast.error(`Failed to delete transaction: ${error.message}`);
        },
        onSettled: () => {
            // Always refetch after error or success
            queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
        },
        onSuccess: () => {
            toast.success('Transaction deleted');
        },
    });
}

