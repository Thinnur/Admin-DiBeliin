// =============================================================================
// DiBeliin Admin - Transaction API Service
// =============================================================================
// Supabase API wrapper for transactions table

import type { TransactionCategoryGroups } from '@/lib/financeCategories';
import { supabase } from '@/lib/supabase';
import type {
    Transaction,
    TransactionInsert,
    TransactionType,
    TransactionUpdate,
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
        const { data, error } = await query.limit(filters.limit);
        if (error) throw new Error(`Failed to fetch transactions: ${error.message}`);
        return (data as Transaction[]) || [];
    }

    const PAGE_SIZE = 1000;
    let from = 0;
    let all: Transaction[] = [];

    while (true) {
        const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(`Failed to fetch transactions: ${error.message}`);
        if (!data || data.length === 0) break;
        all = all.concat(data as Transaction[]);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return all;
}

// -----------------------------------------------------------------------------
// Fetch Transaction Categories
// -----------------------------------------------------------------------------

export async function fetchTransactionCategories(): Promise<TransactionCategoryGroups> {
    const { data, error } = await supabase
        .from('transactions')
        .select('category, transaction_type');

    if (error) {
        throw new Error(`Failed to fetch transaction categories: ${error.message}`);
    }

    const groups: TransactionCategoryGroups = {
        all: [],
        income: [],
        expense: [],
    };
    const seen = {
        all: new Set<string>(),
        income: new Set<string>(),
        expense: new Set<string>(),
    };

    for (const row of data ?? []) {
        const category = row.category?.trim();
        if (!category) continue;

        const normalizedKey = category.toLowerCase();
        if (!seen.all.has(normalizedKey)) {
            seen.all.add(normalizedKey);
            groups.all.push(category);
        }

        const bucket = row.transaction_type === 'income' ? 'income' : 'expense';
        if (!seen[bucket].has(normalizedKey)) {
            seen[bucket].add(normalizedKey);
            groups[bucket].push(category);
        }
    }

    groups.all.sort((a, b) => a.localeCompare(b, 'id-ID'));
    groups.income.sort((a, b) => a.localeCompare(b, 'id-ID'));
    groups.expense.sort((a, b) => a.localeCompare(b, 'id-ID'));

    return groups;
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
    // ---------------------------------------------------------------------------
    // REFACTORED: Kalkulasi agregat sekarang dilakukan di database via RPC.
    // Sebelumnya menggunakan while-loop + reduce di sisi klien yang boros
    // bandwidth dan CPU saat data membesar.
    //
    // Pastikan fungsi RPC `get_financial_summary` sudah di-deploy di Supabase.
    // Lihat: supabase/migrations/get_financial_summary.sql
    // ---------------------------------------------------------------------------

    const { data, error } = await supabase.rpc('get_financial_summary', {
        start_date: dateRange?.startDate ?? null,
        end_date: dateRange?.endDate ?? null,
    });

    if (error) {
        throw new Error(`Failed to fetch financial summary: ${error.message}`);
    }

    // RPC mengembalikan JSON { total_income, total_expense, net_profit }
    return {
        total_income: data?.total_income ?? 0,
        total_expense: data?.total_expense ?? 0,
        net_profit: data?.net_profit ?? 0,
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
    const { date, time, ...rest } = transaction;

    const payload: Record<string, unknown> = { ...rest };
    if (date) {
        // Supabase allows inserting created_at when it's not protected.
        // Use end-of-day time (23:59:59) to keep it within the chosen day.
        payload.created_at = buildCreatedAt(date, time);
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
// Update Transaction
// -----------------------------------------------------------------------------

export async function updateTransaction(
    id: string,
    updates: TransactionUpdate
): Promise<Transaction> {
    const { date, time, ...payload } = updates;
    void date;
    void time;

    const { data, error } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to update transaction: ${error.message}`);
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

function buildCreatedAt(date: string, rawTime?: string): string {
    const now = new Date();
    const time = normalizeTime(rawTime) ?? getCurrentLocalTime(now);

    return `${date}T${time}${getLocalOffset(now)}`;
}

function normalizeTime(rawTime?: string): string | null {
    if (!rawTime) return null;

    const match = rawTime.trim().match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?$/);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3] ?? '0');

    if (hours > 23 || minutes > 59 || seconds > 59) {
        return null;
    }

    return [
        String(hours).padStart(2, '0'),
        String(minutes).padStart(2, '0'),
        String(seconds).padStart(2, '0'),
    ].join(':');
}

function getCurrentLocalTime(date: Date): string {
    return [
        String(date.getHours()).padStart(2, '0'),
        String(date.getMinutes()).padStart(2, '0'),
        String(date.getSeconds()).padStart(2, '0'),
    ].join(':');
}

function getLocalOffset(date: Date): string {
    const totalMinutes = -date.getTimezoneOffset();
    const sign = totalMinutes >= 0 ? '+' : '-';
    const absoluteMinutes = Math.abs(totalMinutes);
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = absoluteMinutes % 60;

    return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
