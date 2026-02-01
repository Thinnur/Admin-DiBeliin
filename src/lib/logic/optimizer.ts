// =============================================================================
// DiBeliin Admin - Order Optimizer
// =============================================================================
// Greedy bin-packing algorithm to split orders across vouchers for max savings

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
// Constants
// -----------------------------------------------------------------------------

// Voucher specifications
const VOUCHER_SPECS = {
    nomin: {
        targetAmount: 70000,    // Ideal order amount
        maxDiscount: 35000,     // Maximum discount
        minOrder: 0,            // No minimum
        discountRate: 0.5,      // 50% discount
    },
    min50k: {
        targetAmount: 60000,    // Ideal order amount
        maxDiscount: 30000,     // Maximum discount
        minOrder: 50000,        // Minimum 50k
        discountRate: 0.5,      // 50% discount
    },
};

// Tolerance for bin packing (how close to target is acceptable)
const TARGET_TOLERANCE = 15000; // ±15k from target

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

/**
 * Calculate discount for a given total and voucher type
 */
function calculateDiscount(total: number, voucherType: 'nomin' | 'min50k'): number {
    const spec = VOUCHER_SPECS[voucherType];

    // Check minimum order requirement
    if (total < spec.minOrder) {
        return 0;
    }

    // Calculate discount (50% up to max)
    const rawDiscount = Math.floor(total * spec.discountRate);
    return Math.min(rawDiscount, spec.maxDiscount);
}

/**
 * Find best voucher type for a given total
 */
function findBestVoucher(total: number, brand: 'kopken' | 'fore'): 'nomin' | 'min50k' {
    // Fore only has NoMin
    if (brand === 'fore') {
        return 'nomin';
    }

    // For KopKen, compare discounts
    const nominDiscount = calculateDiscount(total, 'nomin');
    const min50kDiscount = calculateDiscount(total, 'min50k');

    // If no discount from min50k (below 50k), use nomin
    if (min50kDiscount === 0) {
        return 'nomin';
    }

    // If total is closer to 70k target, prefer nomin
    // If total is closer to 60k target, prefer min50k
    const nominDiff = Math.abs(total - VOUCHER_SPECS.nomin.targetAmount);
    const min50kDiff = Math.abs(total - VOUCHER_SPECS.min50k.targetAmount);

    // Prefer nomin if it's a better fit or has higher discount
    if (nominDiff <= min50kDiff || nominDiscount >= min50kDiscount) {
        return 'nomin';
    }

    return 'min50k';
}

// -----------------------------------------------------------------------------
// Main Optimizer Function
// -----------------------------------------------------------------------------

/**
 * Optimize order splitting across multiple accounts/vouchers
 * 
 * @param items - List of cart items
 * @param brand - Brand (kopken or fore)
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

    // Step 1: Flatten items by quantity
    const flatItems = flattenItems(items);

    // Step 2: Sort by price (highest first) for greedy approach
    flatItems.sort((a, b) => b.price - a.price);

    // Step 3: Greedy bin packing
    const groups: OptimizedGroup[] = [];
    const usedItems = new Set<number>();

    // Primary target: NoMin (~70k)
    const primaryTarget = VOUCHER_SPECS.nomin.targetAmount;
    // Secondary target: Min50k (~60k) - only for KopKen
    const secondaryTarget = brand === 'kopken' ? VOUCHER_SPECS.min50k.targetAmount : primaryTarget;

    let groupId = 1;

    // Keep creating groups while we have unused items
    while (usedItems.size < flatItems.length) {
        const currentGroup: FlatItem[] = [];
        let currentTotal = 0;

        // Try to fill current group to target
        for (let i = 0; i < flatItems.length; i++) {
            if (usedItems.has(i)) continue;

            const item = flatItems[i];
            const newTotal = currentTotal + item.price;

            // Add item if it doesn't exceed target too much
            // or if the group is empty (always add at least one item)
            if (currentGroup.length === 0 || newTotal <= primaryTarget + TARGET_TOLERANCE) {
                currentGroup.push(item);
                currentTotal = newTotal;
                usedItems.add(i);

                // If we're at a good target, stop adding to this group
                if (currentTotal >= primaryTarget - TARGET_TOLERANCE) {
                    break;
                }
            }
        }

        // If group is still below secondary target, try to add smaller items
        if (currentTotal < secondaryTarget - TARGET_TOLERANCE && brand === 'kopken') {
            for (let i = flatItems.length - 1; i >= 0; i--) {
                if (usedItems.has(i)) continue;

                const item = flatItems[i];
                const newTotal = currentTotal + item.price;

                if (newTotal <= secondaryTarget + TARGET_TOLERANCE) {
                    currentGroup.push(item);
                    currentTotal = newTotal;
                    usedItems.add(i);

                    if (currentTotal >= secondaryTarget - TARGET_TOLERANCE) {
                        break;
                    }
                }
            }
        }

        // Determine best voucher for this group
        const recommendedVoucher = findBestVoucher(currentTotal, brand);
        const estimatedDiscount = calculateDiscount(currentTotal, recommendedVoucher);

        groups.push({
            id: groupId++,
            items: currentGroup,
            totalPrice: currentTotal,
            recommendedVoucher,
            estimatedDiscount,
        });
    }

    // Step 4: Cost analysis - merge small groups if not worth the account cost
    const optimizedGroups = mergeSmallGroups(groups, accountCost, brand);

    // Step 5: Calculate totals
    const totalBill = optimizedGroups.reduce((sum, g) => sum + g.totalPrice, 0);
    const totalDiscount = optimizedGroups.reduce((sum, g) => sum + g.estimatedDiscount, 0);
    const totalAdminCost = optimizedGroups.length * accountCost;
    const finalPrice = totalBill - totalDiscount + totalAdminCost;

    return {
        groups: optimizedGroups,
        totalBill,
        totalDiscount,
        totalAdminCost,
        finalPrice,
        accountsNeeded: optimizedGroups.length,
    };
}

/**
 * Merge groups where the savings don't justify the account cost
 */
function mergeSmallGroups(
    groups: OptimizedGroup[],
    accountCost: number,
    brand: 'kopken' | 'fore'
): OptimizedGroup[] {
    if (groups.length <= 1) return groups;

    const result: OptimizedGroup[] = [];

    for (const group of groups) {
        // If this group's discount doesn't cover the account cost, try to merge
        if (group.estimatedDiscount < accountCost && result.length > 0) {
            // Find a group to merge with
            const lastGroup = result[result.length - 1];
            const mergedTotal = lastGroup.totalPrice + group.totalPrice;
            const mergedVoucher = findBestVoucher(mergedTotal, brand);
            const mergedDiscount = calculateDiscount(mergedTotal, mergedVoucher);

            // Check if merging is beneficial
            const separateDiscount = lastGroup.estimatedDiscount + group.estimatedDiscount;
            const separateCost = accountCost * 2;
            const mergedCost = accountCost;

            const separateNet = separateDiscount - separateCost;
            const mergedNet = mergedDiscount - mergedCost;

            if (mergedNet >= separateNet) {
                // Merge the groups
                lastGroup.items.push(...group.items);
                lastGroup.totalPrice = mergedTotal;
                lastGroup.recommendedVoucher = mergedVoucher;
                lastGroup.estimatedDiscount = mergedDiscount;
                continue;
            }
        }

        result.push({ ...group, id: result.length + 1 });
    }

    // Re-number groups
    return result.map((g, i) => ({ ...g, id: i + 1 }));
}

// -----------------------------------------------------------------------------
// Utility: Single Order Analysis
// -----------------------------------------------------------------------------

/**
 * Analyze a single order without splitting
 * Useful for comparison
 */
export function analyzeSingleOrder(
    items: CartItem[],
    brand: 'kopken' | 'fore'
): { total: number; discount: number; voucher: 'nomin' | 'min50k' } {
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const voucher = findBestVoucher(total, brand);
    const discount = calculateDiscount(total, voucher);

    return { total, discount, voucher };
}
