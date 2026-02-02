// =============================================================================
// DiBeliin Admin - Order Optimizer
// =============================================================================
// Exact replication of legacy Google Apps Script logic
// Greedy bin-packing algorithm with 68k limit per group

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CartItem {
    name: string;
    price: number;
    qty: number;
}

export interface FlatItem {
    name: string;
    price: number;
    originalIndex?: number; // Optional for tracking
}

export interface OptimizedGroup {
    id: number;
    items: FlatItem[];
    totalPrice: number;
    recommendedVoucher: 'nomin' | 'min50k';
    estimatedDiscount: number;
}

export interface OptimizationResult {
    groups: OptimizedGroup[];
    totalBill: number;
    totalDiscount: number;
    totalAdminCost: number;
    finalPrice: number;
    accountsNeeded: number;
}

// -----------------------------------------------------------------------------
// Constants (from GAS)
// -----------------------------------------------------------------------------

const MAX_GROUP_LIMIT = 70000; // Hard limit per group

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Flatten cart items by quantity
 * e.g., { name: "Kopi", price: 18000, qty: 2 } → [{ name: "Kopi", price: 18000 }, { name: "Kopi", price: 18000 }]
 */
export function flattenItems(items: CartItem[]): FlatItem[] {
    const flattened: FlatItem[] = [];

    for (const item of items) {
        for (let i = 0; i < item.qty; i++) {
            flattened.push({
                name: item.name,
                price: item.price,
            });
        }
    }

    return flattened;
}

// -----------------------------------------------------------------------------
// Main Optimizer Function (Exact GAS Logic)
// -----------------------------------------------------------------------------

/**
 * Optimize order splitting across multiple accounts/vouchers
 * 
 * GAS Logic:
 * 1. Flatten & Sort by Price Descending (High to Low)
 * 2. Greedy grouping with 68k hard limit
 * 3. Voucher selection: if (50k <= total <= 60k) → min50k, else → nomin
 * 4. Discount: min50k = 50% max 30k, nomin = 50% max 35k
 * 5. Admin fee: Math.max(countNomin, countMin50k) * accountCost
 * 
 * @param items - List of cart items
 * @param brand - Brand (kopken or fore) - kept for compatibility but logic is unified
 * @param accountCost - Cost per account (admin fee)
 * @returns Optimization result with groups and totals
 */
export function optimizeOrder(
    items: CartItem[],
    brand: 'kopken' | 'fore',
    accountCost: number = 5000
): OptimizationResult {
    // Handle empty input
    if (items.length === 0) {
        return {
            groups: [],
            totalBill: 0,
            totalDiscount: 0,
            totalAdminCost: 0,
            finalPrice: 0,
            accountsNeeded: 0,
        };
    }

    // 1. Flatten & Sort (High to Low)
    let flatItems: FlatItem[] = [];
    items.forEach(item => {
        for (let i = 0; i < item.qty; i++) {
            flatItems.push({
                name: item.name,
                price: item.price,
                originalIndex: 0, // temp
            });
        }
    });

    // Sort by Price Descending
    flatItems.sort((a, b) => b.price - a.price);

    const groups: OptimizedGroup[] = [];
    const usedItems = new Set<number>();
    let groupId = 1;

    // 2. Grouping Logic (Greedy Fit with 68k Limit)
    while (usedItems.size < flatItems.length) {
        const currentGroupItems: FlatItem[] = [];
        let currentTotal = 0;

        for (let i = 0; i < flatItems.length; i++) {
            if (usedItems.has(i)) continue;

            const item = flatItems[i];
            // Exact GAS Logic: Check strictly against 68000
            if (currentTotal + item.price <= MAX_GROUP_LIMIT) {
                currentGroupItems.push(item);
                currentTotal += item.price;
                usedItems.add(i);
            }
        }

        if (currentGroupItems.length > 0) {
            // 3. Voucher Strategy & 4. Discount Calculation
            // BRAND SPECIFIC LOGIC
            let recommendedVoucher: 'nomin' | 'min50k' = 'nomin';
            let discount = 0;

            if (brand === 'fore') {
                // FORE: Always 'nomin' - only has No Minimum vouchers
                recommendedVoucher = 'nomin';
                discount = Math.min(currentTotal * 0.5, 35000);
            } else {
                // KOPKEN: Hybrid Logic (Min 50k vs No Min)
                // GAS Logic: if (total >= 50k && total <= 60k) use Min50, else NoMin
                if (currentTotal >= 50000 && currentTotal <= 60000) {
                    recommendedVoucher = 'min50k';
                    discount = Math.min(currentTotal * 0.5, 30000);
                } else {
                    recommendedVoucher = 'nomin';
                    discount = Math.min(currentTotal * 0.5, 35000);
                }
            }

            groups.push({
                id: groupId++,
                items: currentGroupItems,
                totalPrice: currentTotal,
                recommendedVoucher,
                estimatedDiscount: discount,
            });
        } else {
            break; // Safety: if no items could be added, exit to prevent infinite loop
        }
    }

    // 5. Calculate totals
    const totalBill = groups.reduce((sum, g) => sum + g.totalPrice, 0);
    const totalDiscount = groups.reduce((sum, g) => sum + g.estimatedDiscount, 0);

    // Calculate Admin Fees (Combo Logic)
    // Rule: Pair of (NoMin + Min50k) counts as 1 fee
    const countNomin = groups.filter(g => g.recommendedVoucher === 'nomin').length;
    const countMin50k = groups.filter(g => g.recommendedVoucher === 'min50k').length;
    const totalAdminCost = Math.max(countNomin, countMin50k) * accountCost;

    const finalPrice = totalBill - totalDiscount + totalAdminCost;

    return {
        groups,
        totalBill,
        totalDiscount,
        totalAdminCost,
        finalPrice,
        accountsNeeded: groups.length,
    };
}

// -----------------------------------------------------------------------------
// Utility: Single Order Analysis (for comparison)
// -----------------------------------------------------------------------------

/**
 * Analyze a single order without splitting
 * Useful for comparison
 */
export function analyzeSingleOrder(
    items: CartItem[],
    _brand: 'kopken' | 'fore' // kept for compatibility
): { total: number; discount: number; voucher: 'nomin' | 'min50k' } {
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

    // Apply same voucher logic
    let voucher: 'nomin' | 'min50k' = 'nomin';
    if (total >= 50000 && total <= 60000) {
        voucher = 'min50k';
    }

    // Calculate discount with same rules
    let discount = 0;
    if (voucher === 'min50k') {
        discount = Math.min(total * 0.5, 30000);
    } else {
        discount = Math.min(total * 0.5, 35000);
    }

    return { total, discount, voucher };
}
