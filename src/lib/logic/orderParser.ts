// =============================================================================
// DiBeliin Admin - WhatsApp Order Parser
// =============================================================================
// Parse raw WhatsApp order text into structured items

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ParsedItem {
    name: string;
    price: number;
    qty: number;
    rawLine: string;
    hasError: boolean;
    errorMessage?: string;
}

export interface ParseResult {
    items: ParsedItem[];
    unparsedLines: string[];
    totalParsed: number;
    totalUnparsed: number;
}

// -----------------------------------------------------------------------------
// Price Parsing Helpers
// -----------------------------------------------------------------------------

/**
 * Parse price from various formats
 * Handles: 18000, 18.000, 18,000, 18k, 18K, Rp 18.000, IDR 18000
 */
function parsePrice(priceStr: string): number {
    if (!priceStr) return 0;

    // Remove currency prefixes
    let cleaned = priceStr
        .replace(/^(Rp\.?|IDR|rp\.?|idr)\s*/i, '')
        .trim();

    // Handle "k" or "K" suffix (e.g., "18k" = 18000)
    if (/k$/i.test(cleaned)) {
        const num = parseFloat(cleaned.replace(/k$/i, '').replace(/[.,]/g, ''));
        return isNaN(num) ? 0 : num * 1000;
    }

    // Remove thousand separators and parse
    // Handle both dot and comma as thousand separators
    // If number has dot followed by 3 digits, it's a thousand separator
    if (/\.\d{3}$/.test(cleaned)) {
        cleaned = cleaned.replace(/\./g, '');
    } else if (/,\d{3}$/.test(cleaned)) {
        cleaned = cleaned.replace(/,/g, '');
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Parse quantity from various formats
 * Handles: 2, 2x, 2X, x2, X2
 */
function parseQty(qtyStr: string): number {
    if (!qtyStr) return 1;

    const cleaned = qtyStr.replace(/x/gi, '').trim();
    const num = parseInt(cleaned, 10);
    return isNaN(num) || num < 1 ? 1 : num;
}

// -----------------------------------------------------------------------------
// Line Parsing
// -----------------------------------------------------------------------------

/**
 * Parse a single line of WhatsApp order
 * Common formats:
 * - "2 Kopi Kenangan Mantan 18.000"
 * - "3x Americano 15k"
 * - "Latte - 22000"
 * - "Es Kopi Susu 18k"
 * - "2 - Es Kopi Susu - Rp 18.000"
 */
function parseLine(line: string): ParsedItem | null {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) return null;

    // Skip lines that look like headers or separators
    if (/^[-=_*]+$/.test(trimmed)) return null;
    if (/^(order|pesanan|total|subtotal|ongkir|delivery|discount|diskon)/i.test(trimmed)) return null;

    let qty = 1;
    let name = '';
    let price = 0;
    let hasError = false;
    let errorMessage: string | undefined;

    // Pattern 1: Qty at start, price at end
    // e.g., "2 Kopi Kenangan Mantan 18.000" or "2x Americano 15k"
    const pattern1 = /^(\d+x?)\s+(.+?)\s+((?:Rp\.?\s*)?[\d.,]+k?|(?:IDR\s*)?[\d.,]+k?)$/i;
    const match1 = trimmed.match(pattern1);

    if (match1) {
        qty = parseQty(match1[1]);
        name = match1[2].trim();
        price = parsePrice(match1[3]);
    } else {
        // Pattern 2: Name with price separated by dash
        // e.g., "Latte - 22000" or "2 - Es Kopi Susu - 18k"
        const pattern2 = /^(\d+x?)?\s*[-–]\s*(.+?)\s*[-–]\s*((?:Rp\.?\s*)?[\d.,]+k?|(?:IDR\s*)?[\d.,]+k?)$/i;
        const match2 = trimmed.match(pattern2);

        if (match2) {
            qty = match2[1] ? parseQty(match2[1]) : 1;
            name = match2[2].trim();
            price = parsePrice(match2[3]);
        } else {
            // Pattern 3: Just name and price (no qty)
            // e.g., "Es Kopi Susu 18k"
            const pattern3 = /^(.+?)\s+((?:Rp\.?\s*)?[\d.,]+k?|(?:IDR\s*)?[\d.,]+k?)$/i;
            const match3 = trimmed.match(pattern3);

            if (match3) {
                // Check if name starts with a number (could be qty)
                const nameWithQty = /^(\d+x?)\s+(.+)$/i.exec(match3[1]);
                if (nameWithQty) {
                    qty = parseQty(nameWithQty[1]);
                    name = nameWithQty[2].trim();
                } else {
                    name = match3[1].trim();
                }
                price = parsePrice(match3[2]);
            } else {
                // Pattern 4: Just name, no price
                // Use entire line as name, price = 0
                const nameOnly = /^(\d+x?)?\s*(.+)$/i.exec(trimmed);
                if (nameOnly) {
                    qty = nameOnly[1] ? parseQty(nameOnly[1]) : 1;
                    name = nameOnly[2].trim();
                } else {
                    name = trimmed;
                }
                hasError = true;
                errorMessage = 'Price not detected - please enter manually';
            }
        }
    }

    // Clean up name
    name = name
        .replace(/^[-–•]\s*/, '')  // Remove leading dashes/bullets
        .replace(/\s+/g, ' ')       // Normalize whitespace
        .trim();

    if (!name) return null;

    return {
        name,
        price,
        qty,
        rawLine: trimmed,
        hasError,
        errorMessage,
    };
}

// -----------------------------------------------------------------------------
// Main Parser Function
// -----------------------------------------------------------------------------

/**
 * Parse WhatsApp order text into structured items
 * 
 * @param text - Raw text from WhatsApp
 * @returns Parse result with items and unparsed lines
 */
export function parseWhatsAppOrder(text: string): ParseResult {
    const lines = text.split('\n');
    const items: ParsedItem[] = [];
    const unparsedLines: string[] = [];

    for (const line of lines) {
        const parsed = parseLine(line);

        if (parsed) {
            items.push(parsed);
        } else if (line.trim()) {
            unparsedLines.push(line.trim());
        }
    }

    return {
        items,
        unparsedLines,
        totalParsed: items.length,
        totalUnparsed: unparsedLines.length,
    };
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
    return `Rp ${price.toLocaleString('id-ID')}`;
}

/**
 * Generate sample WhatsApp order text for testing
 */
export function getSampleOrderText(): string {
    return `2 Es Kopi Susu 18.000
1 Americano 22k
3x Kopi Kenangan Mantan 18000
Caramel Macchiato - 28.000
2 - Es Coklat - Rp 20.000
Matcha Latte 25k`;
}
