// =============================================================================
// DiBeliin Admin - Order Optimizer (Safe-Guarded Version)
// =============================================================================
// Implements bin-packing strategies for Fore Coffee and Kopi Kenangan

// --- Types (Matching Calculator.tsx API) ---
export interface CartItem {
    name: string;
    price: number;
    qty: number;
}

export interface OptimizedGroup {
    id: string;
    items: { name: string; price: number }[];
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

// --- HELPER: Discount Calculators ---
const calcForeDisc = (price: number) => Math.min(price * 0.5, 35000);
const calcKopKenDiscA = (price: number) => Math.min(price * 0.5, 35000); // No Min, Max 35k
const calcKopKenDiscB = (price: number) => (price >= 50000 ? Math.min(price * 0.5, 30000) : 0); // Min 50k, Max 30k

// --- Helper: Generate unique ID ---
const generateId = () => Math.random().toString(36).substring(2, 11);

// --- Helper: Expand cart items (qty > 1 becomes multiple items) ---
function expandCartItems(items: CartItem[]): { name: string; price: number }[] {
    const expanded: { name: string; price: number }[] = [];
    for (const item of items) {
        for (let i = 0; i < item.qty; i++) {
            expanded.push({ name: item.name, price: item.price });
        }
    }
    return expanded;
}

// ==========================================
// LOGIC 1: FORE (Strict 74k Multiples)
// ==========================================
function optimizeFore(expandedItems: { name: string; price: number }[]): OptimizedGroup[] {
    const groups: OptimizedGroup[] = [];
    const sortedItems = [...expandedItems].sort((a, b) => b.price - a.price);

    // STRICT LIMIT: 74,000. 
    // We prefer filling up to 74k (paying 4k excess) over opening new account (5k cost).
    const BASKET_LIMIT = 74000;

    sortedItems.forEach(item => {
        let placed = false;
        for (const group of groups) {
            if (group.totalPrice + item.price <= BASKET_LIMIT) {
                group.items.push(item);
                group.totalPrice += item.price;
                group.estimatedDiscount = calcForeDisc(group.totalPrice);
                placed = true;
                break;
            }
        }
        if (!placed) {
            groups.push({
                id: generateId(),
                items: [item],
                totalPrice: item.price,
                recommendedVoucher: 'nomin', // Fore only has one voucher type
                estimatedDiscount: calcForeDisc(item.price)
            });
        }
    });
    return groups;
}

// ==========================================
// LOGIC 2: KOPI KENANGAN (Safe-Guarded)
// ==========================================
function optimizeKopKen(expandedItems: { name: string; price: number }[]): OptimizedGroup[] {
    // Strategy A: "All Min-50k" Check (Water Filling)
    const attemptAllMin50 = (itemList: { name: string; price: number }[]): OptimizedGroup[] | null => {
        if (itemList.length === 0) return [];
        const sorted = [...itemList].sort((a, b) => b.price - a.price);
        const total = sorted.reduce((a, b) => a + b.price, 0);

        if (total === 0) return [];

        const minBaskets = Math.ceil(total / 65000);
        const maxBaskets = Math.floor(total / 50000);

        for (let k = maxBaskets; k >= minBaskets; k--) {
            if (k <= 0) continue;
            const baskets: OptimizedGroup[] = Array(k).fill(null).map(() => ({
                id: generateId(),
                items: [],
                totalPrice: 0,
                recommendedVoucher: 'min50k' as const,
                estimatedDiscount: 0
            }));

            for (const item of sorted) {
                baskets.sort((a, b) => a.totalPrice - b.totalPrice);
                baskets[0].items.push(item);
                baskets[0].totalPrice += item.price;
            }

            if (baskets.every(b => b.totalPrice >= 50000)) {
                baskets.forEach(b => b.estimatedDiscount = calcKopKenDiscB(b.totalPrice));
                return baskets;
            }
        }
        return null;
    };

    // Try Strategy A
    const idealSplit = attemptAllMin50(expandedItems);
    if (idealSplit) return idealSplit;

    // Strategy B: Priority Fallback with LOOP GUARD
    const groups: OptimizedGroup[] = [];
    const remainingItems = [...expandedItems].sort((a, b) => b.price - a.price);

    // --- HARD LOOP GUARD ---
    let loopSafetyCounter = 0;
    const MAX_LOOPS = 50;

    while (remainingItems.length > 0) {
        loopSafetyCounter++;

        // EMERGENCY BREAK: If logic spins out of control, dump remaining items and exit.
        if (loopSafetyCounter > MAX_LOOPS) {
            console.error("Optimizer Infinite Loop Detected: Forcing exit.");
            groups.push({
                id: generateId(),
                items: [...remainingItems],
                totalPrice: remainingItems.reduce((s, i) => s + i.price, 0),
                recommendedVoucher: 'nomin',
                estimatedDiscount: 0
            });
            break;
        }

        const currentTotal = remainingItems.reduce((sum, i) => sum + i.price, 0);

        // Condition 1: Exact Range 50k - 60k -> Use Voucher B (Min 50k)
        if (currentTotal >= 50000 && currentTotal <= 60000) {
            groups.push({
                id: generateId(),
                items: [...remainingItems],
                totalPrice: currentTotal,
                recommendedVoucher: 'min50k',
                estimatedDiscount: calcKopKenDiscB(currentTotal)
            });
            break;
        }

        // Condition 2: < 50k OR 60k-70k -> Use Voucher A (No Min)
        if (currentTotal < 50000 || (currentTotal > 60000 && currentTotal <= 70000)) {
            groups.push({
                id: generateId(),
                items: [...remainingItems],
                totalPrice: currentTotal,
                recommendedVoucher: 'nomin',
                estimatedDiscount: calcKopKenDiscA(currentTotal)
            });
            break;
        }

        // Condition 3: Split Strategy (>70k)
        const subsetB: { name: string; price: number }[] = [];
        let currentSubsetSum = 0;
        const indicesToRemove: number[] = [];

        // Search for 50k-60k chunk
        for (let i = 0; i < remainingItems.length; i++) {
            if (currentSubsetSum + remainingItems[i].price <= 60000) {
                currentSubsetSum += remainingItems[i].price;
                subsetB.push(remainingItems[i]);
                indicesToRemove.push(i);
            }
        }

        if (currentSubsetSum >= 50000) {
            // Success: Min-50k Basket
            groups.push({
                id: generateId(),
                items: subsetB,
                totalPrice: currentSubsetSum,
                recommendedVoucher: 'min50k',
                estimatedDiscount: calcKopKenDiscB(currentSubsetSum)
            });
            indicesToRemove.sort((a, b) => b - a).forEach(idx => remainingItems.splice(idx, 1));
        } else {
            // Failure: Fill Voucher A (Max 70k)
            const basketAItems: { name: string; price: number }[] = [];
            let basketASum = 0;
            const removeA: number[] = [];

            for (let i = 0; i < remainingItems.length; i++) {
                if (basketASum + remainingItems[i].price <= 70000) {
                    basketASum += remainingItems[i].price;
                    basketAItems.push(remainingItems[i]);
                    removeA.push(i);
                }
            }

            // --- SAFETY VALVE: Force Progress ---
            if (basketAItems.length === 0 && remainingItems.length > 0) {
                const forcedItem = remainingItems[0];
                basketAItems.push(forcedItem);
                basketASum += forcedItem.price;
                removeA.push(0);
            }

            groups.push({
                id: generateId(),
                items: basketAItems,
                totalPrice: basketASum,
                recommendedVoucher: 'nomin',
                estimatedDiscount: calcKopKenDiscA(basketASum)
            });
            removeA.sort((a, b) => b - a).forEach(idx => remainingItems.splice(idx, 1));
        }
    }

    return groups;
}

// --- MAIN EXPORT (Compatible with Calculator.tsx API) ---
export function optimizeOrder(
    items: CartItem[],
    brand: 'fore' | 'kopken',
    accountCost: number
): OptimizationResult {
    // Safety check
    if (!items || !Array.isArray(items) || items.length === 0) {
        return {
            groups: [],
            totalBill: 0,
            totalDiscount: 0,
            totalAdminCost: 0,
            finalPrice: 0,
            accountsNeeded: 0
        };
    }

    try {
        // Expand items (qty > 1 becomes multiple items)
        const expandedItems = expandCartItems(items);

        // Run brand-specific optimization
        const groups = brand === 'fore'
            ? optimizeFore(expandedItems)
            : optimizeKopKen(expandedItems);

        // Calculate totals
        const totalBill = expandedItems.reduce((sum, i) => sum + i.price, 0);
        const totalDiscount = groups.reduce((sum, g) => sum + g.estimatedDiscount, 0);

        // Admin cost calculation (Combo Pricing for KopKen)
        let accountsNeeded: number;
        if (brand === 'kopken') {
            // Combo Pricing: Max of nomin count vs min50k count
            const nominCount = groups.filter(g => g.recommendedVoucher === 'nomin').length;
            const min50kCount = groups.filter(g => g.recommendedVoucher === 'min50k').length;
            accountsNeeded = Math.max(nominCount, min50kCount);
        } else {
            // Fore: 1 account per group
            accountsNeeded = groups.length;
        }

        const totalAdminCost = accountsNeeded * accountCost;
        const finalPrice = totalBill - totalDiscount + totalAdminCost;

        return {
            groups,
            totalBill,
            totalDiscount,
            totalAdminCost,
            finalPrice,
            accountsNeeded
        };
    } catch (error) {
        console.error("Optimization Critical Error:", error);
        // Fallback to prevent crash
        const totalBill = items.reduce((s, i) => s + (i.price * i.qty), 0);
        return {
            groups: [{
                id: generateId(),
                items: items.map(i => ({ name: i.name, price: i.price * i.qty })),
                totalPrice: totalBill,
                recommendedVoucher: 'nomin',
                estimatedDiscount: 0
            }],
            totalBill,
            totalDiscount: 0,
            totalAdminCost: accountCost,
            finalPrice: totalBill + accountCost,
            accountsNeeded: 1
        };
    }
}
