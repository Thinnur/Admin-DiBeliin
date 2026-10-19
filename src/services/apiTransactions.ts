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
    search?: string;
    /** Kategori yang label tampilannya cocok dengan `search` (label cuma ada di web). */
    labelCategories?: string[];
}

export interface TransactionPage {
    rows: Transaction[];
    total: number;
}

export interface DailyTrendRow {
    day: string; // yyyy-MM-dd, zona waktu browser
    income: number;
    expense: number;
}

// Fungsi migrasi 20261019_finance_server_side belum terpasang -> cara lama.
let serverSideReady = true;
const isMissingFunction = (error: { code?: string } | null) =>
    error?.code === 'PGRST202' || error?.code === '42883';

function buildTransactionsQuery(filters: TransactionFilters, count?: 'exact') {
    const search = filters.search?.trim() || null;
    let query = serverSideReady
        ? supabase.rpc('finance_search_transactions', {
            start_date: filters.startDate ?? null,
            end_date: filters.endDate ?? null,
            q: search,
            label_categories: filters.labelCategories?.length ? filters.labelCategories : null,
        }, { count })
        : supabase.from('transactions').select('*', { count });

    if (!serverSideReady) {
        if (filters.startDate) query = query.gte('created_at', filters.startDate);
        if (filters.endDate) query = query.lte('created_at', filters.endDate);
        // shortcut: fallback tidak mencari nominal/label kategori; hilang setelah migrasi dipasang.
        const safe = search?.replace(/[,()"\\%]/g, ' ');
        if (safe) query = query.or(`description.ilike.%${safe}%,category.ilike.%${safe}%`);
    }
    if (filters.type) query = query.eq('transaction_type', filters.type);
    if (filters.category) query = query.eq('category', filters.category);
    return query.order('created_at', { ascending: false });
}

// -----------------------------------------------------------------------------
// Fetch Transactions (satu halaman, difilter di server)
// -----------------------------------------------------------------------------

export async function fetchTransactionsPage(
    filters: TransactionFilters,
    page: number,
    pageSize: number
): Promise<TransactionPage> {
    const from = page * pageSize;
    let { data, error, count } = await buildTransactionsQuery(filters, 'exact')
        .range(from, from + pageSize - 1);
    if (isMissingFunction(error) && serverSideReady) {
        serverSideReady = false;
        ({ data, error, count } = await buildTransactionsQuery(filters, 'exact')
            .range(from, from + pageSize - 1));
    }
    if (error) throw new Error(`Failed to fetch transactions: ${error.message}`);
    return { rows: (data as Transaction[]) ?? [], total: count ?? 0 };
}

/** Cara lama (sebelum migrasi): semua baris yang cocok, per 1000. */
async function fetchAllMatching(filters: TransactionFilters): Promise<Transaction[]> {
    const PAGE_SIZE = 1000;
    let all: Transaction[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await buildTransactionsQuery(filters).range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(`Failed to fetch transactions: ${error.message}`);
        all = all.concat((data as Transaction[]) ?? []);
        if (!data || data.length < PAGE_SIZE) return all;
    }
}

export async function fetchFilteredSummary(
    filters: TransactionFilters
): Promise<{ income: number; expense: number }> {
    if (serverSideReady) {
        const { data, error } = await supabase.rpc('get_finance_filtered_summary', {
            start_date: filters.startDate ?? null,
            end_date: filters.endDate ?? null,
            q: filters.search?.trim() || null,
            label_categories: filters.labelCategories?.length ? filters.labelCategories : null,
            p_type: filters.type ?? null,
            p_category: filters.category ?? null,
        });
        if (!error) return { income: Number(data?.income ?? 0), expense: Number(data?.expense ?? 0) };
        if (!isMissingFunction(error)) throw new Error(`Failed to fetch summary: ${error.message}`);
        serverSideReady = false;
    }
    return (await fetchAllMatching(filters)).reduce(
        (acc, t) => {
            if (t.transaction_type === 'income') acc.income += t.amount;
            else acc.expense += t.amount;
            return acc;
        },
        { income: 0, expense: 0 }
    );
}

export async function fetchDailyTrend(
    dateRange: SummaryDateRange
): Promise<DailyTrendRow[]> {
    if (serverSideReady) {
        const { data, error } = await supabase.rpc('get_daily_finance_trend', {
            start_date: dateRange.startDate ?? null,
            end_date: dateRange.endDate ?? null,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta',
        });
        if (!error) {
            return ((data ?? []) as DailyTrendRow[]).map((r) => ({
                day: r.day,
                income: Number(r.income),
                expense: Number(r.expense),
            }));
        }
        if (!isMissingFunction(error)) throw new Error(`Failed to fetch trend: ${error.message}`);
        serverSideReady = false;
    }
    const byDay = new Map<string, DailyTrendRow>();
    for (const t of await fetchAllMatching(dateRange)) {
        const day = new Date(t.created_at).toLocaleDateString('sv-SE'); // yyyy-MM-dd lokal
        const row = byDay.get(day) ?? { day, income: 0, expense: 0 };
        if (t.transaction_type === 'income') row.income += t.amount;
        else row.expense += t.amount;
        byDay.set(day, row);
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

// -----------------------------------------------------------------------------
// Fetch Transaction Categories
// -----------------------------------------------------------------------------

/** Sidik jari tabel transactions (jumlah baris + id terbaru), ~ratusan byte.
 * Finance mengeceknya berkala dan baru memuat ulang daftar kalau berubah --
 * jauh lebih hemat daripada polling daftar transaksinya. Edit di tempat
 * (nominal diubah) tidak terdeteksi; itu lewat Finance sendiri & sudah
 * meng-invalidate query-nya. */
export async function fetchTransactionsSignature(): Promise<string> {
    const [jumlah, terbaru] = await Promise.all([
        supabase.from('transactions').select('id', { count: 'exact', head: true }),
        supabase.from('transactions').select('id').order('created_at', { ascending: false }).limit(1),
    ]);
    if (jumlah.error) throw new Error(`Failed to check transactions: ${jumlah.error.message}`);
    if (terbaru.error) throw new Error(`Failed to check transactions: ${terbaru.error.message}`);
    return `${jumlah.count ?? 0}|${terbaru.data?.[0]?.id ?? ''}`;
}

export async function fetchTransactionCategories(): Promise<TransactionCategoryGroups> {
    // Kategori unik dihitung di DB (migrasi 20261006_get_transaction_categories).
    // Fungsi belum terpasang -> cara lama: tarik kolom category semua transaksi
    // (~268 KB, dan server memotong di 5000 baris jadi sebagian kategori hilang).
    let { data, error } = await supabase.rpc('get_transaction_categories');
    if (error) {
        ({ data, error } = await supabase
            .from('transactions')
            .select('category, transaction_type'));
    }

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
