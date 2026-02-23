// =============================================================================
// DiBeliin Admin - Transaction API Service
// =============================================================================
// Supabase API wrapper for transactions table

import { supabase } from '@/lib/supabase';
import type {
    Transaction,
    TransactionInsert,
    TransactionType,
} from '@/types/database';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TransactionFilters {
    type?: TransactionType;
    startDate?: string;
    endDate?: string;
    category?: string;
    limit?: number;
}

// -----------------------------------------------------------------------------
// Fetch Transactions
// -----------------------------------------------------------------------------

export async function fetchTransactions(
    filters?: TransactionFilters
): Promise<Transaction[]> {
    let query = supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

    if (filters?.type) {
        query = query.eq('transaction_type', filters.type);
    }

    if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
    }

    if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
    }

    if (filters?.category) {
        query = query.eq('category', filters.category);
    }

    if (filters?.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    return data || [];
}

// -----------------------------------------------------------------------------
// Fetch Financial Summary
// -----------------------------------------------------------------------------

// Local return type for financial summary
interface FinancialSummaryResult {
    total_income: number;
    total_expense: number;
    net_profit: number;
}

export interface SummaryDateRange {
    startDate?: string; // ISO string
    endDate?: string;   // ISO string
}

export async function fetchFinancialSummary(
    dateRange?: SummaryDateRange
): Promise<FinancialSummaryResult> {
    // Supabase returns max 1000 rows per request by default.
    // Paginate to fetch transactions for accurate totals.
    const PAGE_SIZE = 1000;
    let allTransactions: { transaction_type: string; amount: number }[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        let query = supabase
            .from('transactions')
            .select('transaction_type, amount')
            .range(from, from + PAGE_SIZE - 1);

        if (dateRange?.startDate) {
            query = query.gte('created_at', dateRange.startDate);
        }
        if (dateRange?.endDate) {
            query = query.lte('created_at', dateRange.endDate);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Failed to fetch financial summary: ${error.message}`);
        }

        const batch = data || [];
        allTransactions = [...allTransactions, ...batch];
        hasMore = batch.length === PAGE_SIZE;
        from += PAGE_SIZE;
    }

    const totalIncome = allTransactions
        .filter((t) => t.transaction_type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpense = allTransactions
        .filter((t) => t.transaction_type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    return {
        total_income: totalIncome,
        total_expense: totalExpense,
        net_profit: totalIncome - totalExpense,
    };
}

// -----------------------------------------------------------------------------
// Create Transaction
// -----------------------------------------------------------------------------

export async function createTransaction(
    transaction: TransactionInsert
): Promise<Transaction> {
    // Extract the optional date field — it's not a real DB column.
    // We use it to override created_at so the user-selected date is saved.
    const { date, ...rest } = transaction;

    const payload: Record<string, unknown> = { ...rest };
    if (date) {
        // Supabase allows inserting created_at when it's not protected.
        // Use end-of-day time (23:59:59) to keep it within the chosen day.
        payload.created_at = `${date}T23:59:59+07:00`;
    }

    const { data, error } = await supabase
        .from('transactions')
        .insert(payload)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return data;
}

// -----------------------------------------------------------------------------
// Delete Transaction
// -----------------------------------------------------------------------------

export async function deleteTransaction(id: string): Promise<void> {
    const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to delete transaction: ${error.message}`);
    }
}
