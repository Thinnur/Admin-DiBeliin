// =============================================================================
// DiBeliin Admin - WhatsApp Order Parser (Robust Version)
// =============================================================================
// Parse raw WhatsApp order text into structured items
// Handles "dirty" input with Markdown, varied spacing, and multi-line formats

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ParsedItem {
    id: string;
    name: string;
    qty: number;
    price: number;
    // Legacy properties for backward compatibility with Calculator.tsx
    rawLine?: string;
    hasError?: boolean;
    errorMessage?: string;
}

export interface ParseResult {
    items: ParsedItem[];
    unparsedLines: string[];
    totalParsed: number;
    totalUnparsed: number;
}

// -----------------------------------------------------------------------------
// Main Parser Function
// -----------------------------------------------------------------------------

/**
 * Parse WhatsApp order text into structured items
 * 
 * This is a ROBUST parser that handles:
 * - Markdown formatting (*, _)
 * - Varied spacing and newlines
 * - Multi-line format (item on one line, price on next)
 * - Both "x" and "×" quantity indicators
 * 
 * @param text - Raw text from WhatsApp
 * @returns Array of parsed items
 */
export function parseWhatsAppOrder(text: string): ParseResult {
    const items: ParsedItem[] = [];
    const unparsedLines: string[] = [];

    // 1. Cleaning & Normalization
    // Split lines, trim, and remove empty lines
    const lines = text
        .split(/\r?\n/) // Handle both \n and \r\n
        .map(line => line.trim())
        .filter(line => line !== '');

    let currentItem: Partial<ParsedItem> | null = null;

    // Regex Patterns
    // Matches: "1. Kopi Susu x 2", "Kopi x2", "Cloud Macchiato x4"
    // Group 1: Name, Group 2: Qty
    const itemRegex = /(?:^\d+\.\s*)?(.+?)\s+[xX×]\s*(\d+)$/i;

    // Matches: "Rp 112.000", "112.000", "112000"
    const priceRegex = /^(?:Rp\.?|IDR)?\s*([\d.,]+)$/i;

    for (const line of lines) {
        // Remove Markdown formatting (* or _)
        const cleanLine = line.replace(/[*_]/g, '').trim();

        // Skip obvious header/footer lines
        if (/^(order|pesanan|total|subtotal|ongkir|delivery|discount|diskon|---)/i.test(cleanLine)) {
            continue;
        }

        // CHECK FOR ITEM
        const itemMatch = cleanLine.match(itemRegex);
        if (itemMatch) {
            // If previous item exists but has no price, save it with hasError
            if (currentItem) {
                items.push({
                    id: currentItem.id || crypto.randomUUID(),
                    name: currentItem.name || '',
                    qty: currentItem.qty || 1,
                    price: 0,
                    rawLine: currentItem.rawLine,
                    hasError: true,
                    errorMessage: 'Price not detected - please enter manually',
                } as ParsedItem);
            }

            currentItem = {
                id: crypto.randomUUID(),
                name: itemMatch[1].trim(),
                qty: parseInt(itemMatch[2], 10) || 1,
                price: 0,
                rawLine: cleanLine,
                hasError: false,
            };
            continue;
        }

        // CHECK FOR PRICE (Only if we have a pending item)
        if (currentItem) {
            // Remove everything except numbers to check raw value
            const digitsOnly = cleanLine.replace(/[^\d]/g, '');

            // Basic check: is this line primarily a price?
            if (digitsOnly.length >= 3 && priceRegex.test(cleanLine)) {
                const rawTotalPrice = parseInt(digitsOnly, 10);

                // Calculate Unit Price (Total / Qty)
                const unitPrice = Math.round(rawTotalPrice / (currentItem.qty || 1));

                currentItem.price = unitPrice;
                currentItem.rawLine = `${currentItem.rawLine}\n${cleanLine}`;
                currentItem.hasError = false;

                items.push(currentItem as ParsedItem);
                currentItem = null; // Reset
                continue;
            }
        }

        // Line didn't match item or price pattern
        if (!currentItem) {
            unparsedLines.push(cleanLine);
        }
    }

    // Push last item if pending (with error since no price was found)
    if (currentItem) {
        items.push({
            id: currentItem.id || crypto.randomUUID(),
            name: currentItem.name || '',
            qty: currentItem.qty || 1,
            price: 0,
            rawLine: currentItem.rawLine,
            hasError: true,
            errorMessage: 'Price not detected - please enter manually',
        } as ParsedItem);
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
    return `1. Cloud Caramel Macchiato - Regular x4
   Rp 112.000
2. Matcha Espresso - Regular x4
   Rp 108.000
3. Es Kopi Susu x2
   Rp 36.000`;
}
