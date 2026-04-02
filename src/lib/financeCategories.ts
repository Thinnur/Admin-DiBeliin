import type { TransactionType } from '@/types/database';

export interface TransactionCategoryGroups {
    all: string[];
    income: string[];
    expense: string[];
}

export const DEFAULT_INCOME_CATEGORIES = [
    { value: 'penjualan', label: 'Penjualan Akun' },
    { value: 'jasa', label: 'Jasa Lainnya' },
    { value: 'lain', label: 'Pendapatan Lain' },
] as const;

export const DEFAULT_EXPENSE_CATEGORIES = [
    { value: 'beli_akun', label: 'Beli Akun' },
    { value: 'server', label: 'Server / Hosting' },
    { value: 'operasional', label: 'Biaya Operasional' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'stock', label: 'Stock' },
    { value: 'lain', label: 'Pengeluaran Lain' },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
    penjualan: 'Penjualan',
    jasa: 'Jasa',
    lain: 'Lainnya',
    beli_akun: 'Beli Akun',
    server: 'Server',
    operasional: 'Operasional',
    marketing: 'Marketing',
    stock: 'Stock',
};

export function normalizeCategoryValue(value: string): string {
    return value.trim();
}

function dedupeCategories(values: string[]): string[] {
    const seen = new Map<string, string>();

    for (const rawValue of values) {
        const value = normalizeCategoryValue(rawValue);
        if (!value) continue;

        const key = value.toLowerCase();
        if (!seen.has(key)) {
            seen.set(key, value);
        }
    }

    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'id-ID'));
}

export function formatCategoryLabel(category: string): string {
    const normalized = normalizeCategoryValue(category);
    if (!normalized) return '-';

    const mapped = CATEGORY_LABELS[normalized.toLowerCase()];
    if (mapped) return mapped;

    if (normalized.includes(' ') || /[A-Z]/.test(normalized)) {
        return normalized;
    }

    return normalized
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getCategorySuggestions(
    type: TransactionType,
    categoryGroups?: TransactionCategoryGroups,
): string[] {
    const defaults = type === 'income'
        ? DEFAULT_INCOME_CATEGORIES.map((category) => category.value)
        : DEFAULT_EXPENSE_CATEGORIES.map((category) => category.value);

    const dynamic = type === 'income'
        ? (categoryGroups?.income ?? [])
        : (categoryGroups?.expense ?? []);

    return dedupeCategories([...defaults, ...dynamic]);
}

export function getAllCategorySuggestions(categoryGroups?: TransactionCategoryGroups): string[] {
    return dedupeCategories([
        ...DEFAULT_INCOME_CATEGORIES.map((category) => category.value),
        ...DEFAULT_EXPENSE_CATEGORIES.map((category) => category.value),
        ...(categoryGroups?.all ?? []),
    ]);
}
