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

export async function fetchFinancialSummary(): Promise<FinancialSummaryResult> {
    // Get current month boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const { data, error } = await supabase
        .from('transactions')
        .select('transaction_type, amount')
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

    if (error) {
        throw new Error(`Failed to fetch financial summary: ${error.message}`);
    }

    const transactions = data || [];

    const totalIncome = transactions
        .filter((t) => t.transaction_type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpense = transactions
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
    const { data, error } = await supabase
        .from('transactions')
        .insert(transaction)
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
