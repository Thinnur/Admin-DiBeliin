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
import type { TransactionFilters } from '@/services/apiTransactions';
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
// Query: Financial Summary
// -----------------------------------------------------------------------------

export function useFinancialSummary(
    options?: Omit<UseQueryOptions<FinancialSummary, Error>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: queryKeys.transactions.summary(),
        queryFn: fetchFinancialSummary,
        ...options,
    });
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
