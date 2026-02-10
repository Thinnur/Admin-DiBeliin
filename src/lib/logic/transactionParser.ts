// =============================================================================
// DiBeliin Admin - Transaction Bulk Text Parser
// =============================================================================
// Parses bulk transaction text into structured data.
// Each line represents one transaction: amount and optional description.
//
// Supported formats per line:
//   50000 Penjualan akun ke @user
//   50000, Penjualan akun ke @user
//   Rp 50.000 Penjualan akun
//   50.000 - Jasa order
//   50000
//
// Lines without a valid amount are ignored.

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ParsedTransaction {
    amount: number;
    description: string;
}

export interface TransactionParseResult {
    transactions: ParsedTransaction[];
    totalAmount: number;
    detectedCount: number;
}

// -----------------------------------------------------------------------------
// Amount Parser
// -----------------------------------------------------------------------------

/**
 * Parse Indonesian currency amounts:
 *   "50000" -> 50000
 *   "50.000" -> 50000
 *   "Rp 50.000" -> 50000
 *   "Rp50000" -> 50000
 *   "1.250.000" -> 1250000
 */
function parseAmount(raw: string): number | null {
    // Strip "Rp", "rp", spaces
    let cleaned = raw.replace(/[Rr][Pp]\s*/g, '').trim();

    // If it has dots used as thousand separators (e.g. 50.000), remove them
    // But don't remove a single dot that looks like a decimal (e.g. 50.5)
    if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
        cleaned = cleaned.replace(/\./g, '');
    }

    const num = parseInt(cleaned, 10);
    if (isNaN(num) || num <= 0) return null;
    return num;
}

// -----------------------------------------------------------------------------
// Main Parser
// -----------------------------------------------------------------------------

/**
 * Parse bulk transaction text.
 *
 * Each non-empty line is parsed for an amount (required) and description (optional).
 * Lines that don't start with a recognizable amount are skipped.
 *
 * Example input:
 * ```
 * 50000 Penjualan akun KopKen @user1
 * 50000 Penjualan akun KopKen @user2
 * 75000 Penjualan akun Fore @user3
 * ```
 */
export function parseTransactionBulkText(text: string): TransactionParseResult {
    const lines = text.split(/\r?\n/);
    const transactions: ParsedTransaction[] = [];

    // Regex: optional "Rp" prefix, then digits (with optional dot separators),
    // then optional separator (space, comma, dash, tab), then optional description
    const lineRegex = /^(?:[Rr][Pp]\s*)?(\d[\d.]*)\s*[,\-–—\t]?\s*(.*)?$/;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const match = trimmed.match(lineRegex);
        if (!match) continue;

        const amount = parseAmount(match[1]);
        if (!amount) continue;

        const description = (match[2] || '').trim();

        transactions.push({ amount, description });
    }

    return {
        transactions,
        totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
        detectedCount: transactions.length,
    };
}
