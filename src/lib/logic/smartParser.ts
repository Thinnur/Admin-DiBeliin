// =============================================================================
// DiBeliin Admin - Smart Bulk Text Parser
// =============================================================================
// Parses unstructured seller text into structured account data.
// Handles phone normalization, global PIN detection, and Indonesian date parsing.

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ParsedAccount {
    phone: string;
    password: string;
}

export interface ParseResult {
    accounts: ParsedAccount[];
    globalExpiry: string | null; // ISO YYYY-MM-DD
    detectedCount: number;
}

// -----------------------------------------------------------------------------
// Indonesian Month Map
// -----------------------------------------------------------------------------

const MONTH_MAP: Record<string, number> = {
    // Full names
    januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
    juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
    // Short names
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, agu: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

// -----------------------------------------------------------------------------
// Phone Normalization
// -----------------------------------------------------------------------------

/**
 * Normalize a phone number string:
 * - Strip all non-digit characters
 * - Remove leading +62, 62, or 0
 * - Result always starts with 8
 */
function normalizePhone(raw: string): string | null {
    // Strip everything except digits
    const digits = raw.replace(/\D/g, '');

    let normalized: string;

    if (digits.startsWith('62')) {
        // +62 or 62 prefix
        normalized = digits.slice(2);
    } else if (digits.startsWith('0')) {
        // 0 prefix
        normalized = digits.slice(1);
    } else {
        normalized = digits;
    }

    // Must start with 8 and be at least 9 digits (Indonesian mobile)
    if (normalized.startsWith('8') && normalized.length >= 9 && normalized.length <= 13) {
        return normalized;
    }

    return null;
}

// -----------------------------------------------------------------------------
// Date Detection
// -----------------------------------------------------------------------------

/**
 * Try to parse an Indonesian date string into ISO format YYYY-MM-DD.
 * Supports formats like:
 *   "20 maret 2026", "20/03/2026", "20-03-2026", "2026-03-20"
 */
function parseIndonesianDate(text: string): string | null {
    const trimmed = text.trim().toLowerCase();

    // Format: "20 maret 2026" or "20 mar 2026"
    const namedMatch = trimmed.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (namedMatch) {
        const day = parseInt(namedMatch[1], 10);
        const monthName = namedMatch[2];
        const year = parseInt(namedMatch[3], 10);
        const month = MONTH_MAP[monthName];
        if (month && day >= 1 && day <= 31 && year >= 2020) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }

    // Format: "20/03/2026" or "20-03-2026" (DD/MM/YYYY)
    const slashMatch = trimmed.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
    if (slashMatch) {
        const day = parseInt(slashMatch[1], 10);
        const month = parseInt(slashMatch[2], 10);
        const year = parseInt(slashMatch[3], 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }

    // Format: "2026-03-20" (ISO, already standard)
    const isoMatch = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day = parseInt(isoMatch[3], 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }

    return null;
}

// -----------------------------------------------------------------------------
// Main Parser
// -----------------------------------------------------------------------------

/**
 * Parse unstructured seller text into structured account data.
 *
 * Example input:
 * ```
 * akun :
 * +6285607637577
 * +6283821585437
 * 085839073898
 *
 * Pin : 080808
 * Berlaku sampai : 20 maret 2026
 * ```
 */
export function parseBulkText(text: string): ParseResult {
    const lines = text.split(/\r?\n/);

    const phones: string[] = [];
    let globalPassword: string | null = null;
    let globalExpiry: string | null = null;

    // Phone number regex: matches +62xxx, 62xxx, 08xxx, or standalone 8xxx
    const phoneRegex = /(?:\+?62|0)?8\d{8,12}/;

    // PIN/Password keywords regex
    const pinRegex = /(?:pin|pass|password)\s*[:=]\s*(.+)/i;

    // Expiry date keywords regex
    const expiryRegex = /(?:berlaku|expiry|exp|valid|sampai|expired?)\s*(?:sampai|hingga|s\.?d\.?)?\s*[:=]?\s*(.+)/i;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Check for phone numbers
        const phoneMatch = trimmed.match(phoneRegex);
        if (phoneMatch) {
            const normalized = normalizePhone(phoneMatch[0]);
            if (normalized) {
                phones.push(normalized);
                continue;
            }
        }

        // Check for global PIN/password
        const pinMatch = trimmed.match(pinRegex);
        if (pinMatch) {
            globalPassword = pinMatch[1].trim();
            continue;
        }

        // Check for expiry date
        const expiryMatch = trimmed.match(expiryRegex);
        if (expiryMatch) {
            const parsed = parseIndonesianDate(expiryMatch[1]);
            if (parsed) {
                globalExpiry = parsed;
                continue;
            }
        }

        // Fallback: try to parse the whole line as a date
        if (!globalExpiry) {
            const dateFallback = parseIndonesianDate(trimmed);
            if (dateFallback) {
                globalExpiry = dateFallback;
            }
        }
    }

    // Build accounts array
    const accounts: ParsedAccount[] = phones.map((phone) => ({
        phone,
        password: globalPassword || '',
    }));

    return {
        accounts,
        globalExpiry,
        detectedCount: accounts.length,
    };
}
