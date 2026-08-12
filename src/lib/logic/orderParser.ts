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
    /** Porsi `price` (per-unit) yang tidak ikut diskon produk brand, mis. Kopken
     * Syrup/Topping/Espresso Shot. Hanya terisi saat hidrasi dari qris_orders
     * (lihat Calculator.tsx) — order hasil parse teks WA manual tidak punya info ini. */
    nonDiscountablePrice?: number;
    addons?: string[];
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
    customerName?: string;
    outlet?: string;
    /** "HH:MM" (jadwal) kalau ada baris "Jam Pengambilan: 17:00", atau undefined
     * kalau "Jam Pengambilan: Sekarang" / gak ada baris itu sama sekali (Pickup
     * Sekarang). Baris ini di-generate oleh UniversalCart.tsx (DIBeliin) waktu
     * customer checkout — bukan diketik manual, jadi format-nya selalu konsisten. */
    pickupTime?: string;
}

interface PendingItem {
    id: string;
    name: string;
    qty: number;
    rawLine: string;
    addons: string[];
}

const ITEM_REGEX = /(?:^\d+[.)]\s*)?(.+?)\s+(?:x|X|\u00D7)\s*(\d+)$/;
const PURE_PRICE_REGEX = /^(?:rp\.?|idr)?\s*([\d.,]+)$/i;
const ITEM_META_REGEX = /^(order|pesanan|detail pembayaran|total|subtotal|ongkir|delivery|discount|diskon|biaya admin|admin fee|terima kasih|nama|outlet|jam pengambilan)\b/i;
const NAMA_REGEX = /^nama\s*:\s*(.+)$/i;
const OUTLET_REGEX = /^outlet\s*:\s*(.+)$/i;
const JAM_PENGAMBILAN_REGEX = /^jam\s*pengambilan\s*:\s*(.+)$/i;
const VALID_PICKUP_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function parsePrice(line: string): number | null {
    if (!PURE_PRICE_REGEX.test(line)) return null;

    const digitsOnly = line.replace(/[^\d]/g, '');
    if (digitsOnly.length < 3) return null;

    const parsed = parseInt(digitsOnly, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function isAddonLine(line: string): boolean {
    if (ITEM_META_REGEX.test(line)) return false;

    return /^(add[\s-]?on|addon|topping|extra|sweetness|ice cube|size|catatan|notes?)\b/i.test(line)
        || /^[A-Za-z][A-Za-z\s-]{1,25}\s*:\s*.+$/.test(line);
}

function pushPendingAsError(target: PendingItem, items: ParsedItem[]): void {
    items.push({
        id: target.id,
        name: target.name,
        qty: target.qty,
        price: 0,
        addons: target.addons,
        rawLine: target.rawLine,
        hasError: true,
        errorMessage: 'Price not detected - please enter manually',
    });
}

// -----------------------------------------------------------------------------
// Main Parser Function
// -----------------------------------------------------------------------------

/**
 * Parse WhatsApp order text into structured items.
 *
 * This parser handles:
 * - Markdown formatting (*, _)
 * - Varied spacing and newlines
 * - Multi-line format (item on one line, price on next)
 * - Quantity with x / X / multiplication sign
 * - Item add-ons / notes lines between item and price
 */
export function parseWhatsAppOrder(text: string): ParseResult {
    const items: ParsedItem[] = [];
    const unparsedLines: string[] = [];
    let customerName: string | undefined;
    let outlet: string | undefined;
    let pickupTime: string | undefined;

    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== '');

    let currentItem: PendingItem | null = null;

    for (const line of lines) {
        const cleanLine = line.replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
        if (!cleanLine) continue;

        // Skip clear separators
        if (/^[\-\u2013\u2014\u2500]{3,}$/.test(cleanLine)) {
            continue;
        }

        // Skip obvious header/footer lines when not inside an item block
        if (!currentItem && ITEM_META_REGEX.test(cleanLine)) {
            const namaMatch = cleanLine.match(NAMA_REGEX);
            if (namaMatch) customerName = namaMatch[1].trim();
            const outletMatch = cleanLine.match(OUTLET_REGEX);
            if (outletMatch) outlet = outletMatch[1].trim();
            const jamMatch = cleanLine.match(JAM_PENGAMBILAN_REGEX);
            if (jamMatch) {
                const value = jamMatch[1].trim();
                // "Sekarang" = Pickup Sekarang (ASAP), sama kayak gak ada baris ini
                // sama sekali -> pickupTime dibiarkan undefined.
                if (VALID_PICKUP_TIME_REGEX.test(value)) pickupTime = value;
            }
            continue;
        }

        // ITEM HEADER LINE
        const itemMatch = cleanLine.match(ITEM_REGEX);
        if (itemMatch) {
            if (currentItem) {
                pushPendingAsError(currentItem, items);
            }

            currentItem = {
                id: crypto.randomUUID(),
                name: itemMatch[1].trim(),
                qty: parseInt(itemMatch[2], 10) || 1,
                rawLine: cleanLine,
                addons: [],
            };
            continue;
        }

        if (currentItem) {
            // PRICE LINE
            const parsedPrice = parsePrice(cleanLine);
            if (parsedPrice !== null) {
                const unitPrice = Math.round(parsedPrice / currentItem.qty);

                items.push({
                    id: currentItem.id,
                    name: currentItem.name,
                    qty: currentItem.qty,
                    price: unitPrice,
                    addons: currentItem.addons,
                    rawLine: `${currentItem.rawLine}\n${cleanLine}`,
                    hasError: false,
                });

                currentItem = null;
                continue;
            }

            // ADD-ON / DETAIL LINE
            if (isAddonLine(cleanLine)) {
                const detail = cleanLine.replace(/^[-\u2022]\s*/, '').trim();
                currentItem.addons.push(detail);
                currentItem.rawLine = `${currentItem.rawLine}\n${cleanLine}`;
                continue;
            }
        }

        if (!currentItem) {
            unparsedLines.push(cleanLine);
        }
    }

    if (currentItem) {
        pushPendingAsError(currentItem, items);
    }

    return {
        items,
        unparsedLines,
        totalParsed: items.length,
        totalUnparsed: unparsedLines.length,
        customerName,
        outlet,
        pickupTime,
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
   Sweetness: Normal Sweet
   Ice Cube: Less Ice
   Rp 112.000
2. Matcha Espresso - Regular x4
   Sweetness: Less Sweet
   Ice Cube: Normal Ice
   Rp 108.000
3. Es Kopi Susu x2
   Add On: Oat Milk
   Rp 36.000`;
}
