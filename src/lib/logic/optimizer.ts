// =============================================================================
// DiBeliin Admin - Order Optimizer
// =============================================================================
// Implements optimization strategies for Fore Coffee and Kopi Kenangan.
//
// FORE COFFEE: flat 25% discount, capped Rp 50.000 per account. Order splits
// into g = ceil(discountableTotal / 200000) accounts — the minimum number
// such that no basket is ever capped, so total discount is always exactly
// 25% of the order (closed-form, no search needed). Admin cost is charged
// per line-item quantity (accountCost is interpreted as "fee per cup" for
// this brand), independent of how many accounts the discount used.
//
// KOPI KENANGAN: Unchanged bin-packing with nomin/min50k vouchers.

// --- Types ---

export interface CartItem {
    name: string;
    /** actualPrice: harga yang dibayar (Regular = harga regular, Large = harga Large) */
    price: number;
    qty: number;
    addons?: string[];
    /**
     * basePrice: harga Regular menu (untuk kalkulasi diskon BOGO Tomoro).
     * Jika tidak diisi, dianggap sama dengan actualPrice.
     */
    basePrice?: number;
    size?: 'small' | 'regular' | 'large';
}

export interface OptimizedGroup {
    id: string;
    items: {
        name: string;
        addons?: string[];
        /** actualPrice unit */
        price: number;
        /** basePrice unit (same as price if not set) */
        basePrice: number;
        /** If this item is the free one in a BOGO pair */
        isBogoDFree?: boolean;
    }[];
    totalPrice: number;
    recommendedVoucher: 'nomin' | 'min50k' | 'fore_25pct' | 'tomoro_bogo' | 'tomoro_50' | 'jiwa_50';
    estimatedDiscount: number;
    /** For BOGO groups: the base-price discount applied */
    bogoDiscount?: number;
}

export interface OptimizationResult {
    groups: OptimizedGroup[];
    totalBill: number;
    totalDiscount: number;
    totalAdminCost: number;
    finalPrice: number;
    accountsNeeded: number;
}

// --- Toggle flags ---
export const ENABLE_FORE_35PCT = false; // Disable temporarily per user request

// --- Constants ---
const FORE_25_RATE = 0.25;
const FORE_25_MAX_DISCOUNT = 50000;
const FORE_BASKET_SATURATION = 200000; // 25% of this = exactly FORE_25_MAX_DISCOUNT

// --- Helper: Generate unique ID ---
const generateId = () => Math.random().toString(36).substring(2, 11);

// --- Helper: Expand cart items (qty > 1 becomes multiple unit items) ---
function expandCartItems(items: CartItem[]): {
    name: string;
    price: number;
    addons: string[];
}[] {
    const expanded: { name: string; price: number; addons: string[] }[] = [];
    for (const item of items) {
        const addons = item.addons ?? [];
        for (let i = 0; i < item.qty; i++) {
            expanded.push({
                name: item.name,
                price: item.price,
                addons: [...addons],
            });
        }
    }
    return expanded;
}

// ==========================================
// LOGIC 1: FORE (flat 25%, closed-form basket split)
// ==========================================

type ForeItem = {
    name: string;
    price: number; // actualPrice per unit
    addons: string[];
};

function optimizeFore(expandedItems: ForeItem[]): OptimizedGroup[] {
    if (expandedItems.length === 0) return [];

    const discountableTotal = expandedItems.reduce((s, i) => s + i.price, 0);
    const g = Math.max(1, Math.ceil(discountableTotal / FORE_BASKET_SATURATION));

    const sorted = [...expandedItems].sort((a, b) => b.price - a.price);
    const baskets: OptimizedGroup[] = Array(g).fill(null).map(() => ({
        id: generateId(),
        items: [],
        totalPrice: 0,
        recommendedVoucher: 'fore_25pct' as const,
        estimatedDiscount: 0,
    }));

    for (const item of sorted) {
        baskets.sort((a, b) => a.totalPrice - b.totalPrice);
        baskets[0].items.push({
            name: item.name,
            addons: item.addons,
            price: item.price,
            basePrice: item.price,
        });
        baskets[0].totalPrice += item.price;
    }

    for (const b of baskets) {
        b.estimatedDiscount = Math.min(b.totalPrice * FORE_25_RATE, FORE_25_MAX_DISCOUNT);
    }

    return baskets;
}

// ==========================================
// LOGIC 2: KOPI KENANGAN (Unchanged)
// ==========================================

const calcKopKenDiscA = (price: number) => Math.min(price * 0.5, 35000);
const calcKopKenDiscB = (price: number) => (price >= 50000 ? Math.min(price * 0.5, 30000) : 0);

function expandKopKenItems(items: CartItem[]): { name: string; price: number; addons: string[] }[] {
    const expanded: { name: string; price: number; addons: string[] }[] = [];
    for (const item of items) {
        for (let i = 0; i < item.qty; i++) {
            expanded.push({ name: item.name, price: item.price, addons: item.addons ?? [] });
        }
    }
    return expanded;
}

function optimizeKopKen(expandedItems: { name: string; price: number; addons: string[] }[]): OptimizedGroup[] {
    const attemptAllMin50 = (itemList: { name: string; price: number; addons: string[] }[]): OptimizedGroup[] | null => {
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
                estimatedDiscount: 0,
            }));

            for (const item of sorted) {
                baskets.sort((a, b) => a.totalPrice - b.totalPrice);
                baskets[0].items.push({ name: item.name, addons: item.addons, price: item.price, basePrice: item.price });
                baskets[0].totalPrice += item.price;
            }

            if (baskets.every(b => b.totalPrice >= 50000)) {
                baskets.forEach(b => (b.estimatedDiscount = calcKopKenDiscB(b.totalPrice)));
                return baskets;
            }
        }
        return null;
    };

    const idealSplit = attemptAllMin50(expandedItems);
    if (idealSplit) return idealSplit;

    const groups: OptimizedGroup[] = [];
    const remainingItems = [...expandedItems].sort((a, b) => b.price - a.price);
    let loopSafetyCounter = 0;
    const MAX_LOOPS = 50;

    while (remainingItems.length > 0) {
        loopSafetyCounter++;
        if (loopSafetyCounter > MAX_LOOPS) {
            console.error('Optimizer Infinite Loop Detected: Forcing exit.');
            groups.push({
                id: generateId(),
                items: remainingItems.map(i => ({ name: i.name, addons: i.addons, price: i.price, basePrice: i.price })),
                totalPrice: remainingItems.reduce((s, i) => s + i.price, 0),
                recommendedVoucher: 'nomin',
                estimatedDiscount: 0,
            });
            break;
        }

        const currentTotal = remainingItems.reduce((sum, i) => sum + i.price, 0);

        if (currentTotal >= 50000 && currentTotal <= 60000) {
            groups.push({
                id: generateId(),
                items: remainingItems.map(i => ({ name: i.name, addons: i.addons, price: i.price, basePrice: i.price })),
                totalPrice: currentTotal,
                recommendedVoucher: 'min50k',
                estimatedDiscount: calcKopKenDiscB(currentTotal),
            });
            break;
        }

        if (currentTotal < 50000 || (currentTotal > 60000 && currentTotal <= 70000)) {
            groups.push({
                id: generateId(),
                items: remainingItems.map(i => ({ name: i.name, addons: i.addons, price: i.price, basePrice: i.price })),
                totalPrice: currentTotal,
                recommendedVoucher: 'nomin',
                estimatedDiscount: calcKopKenDiscA(currentTotal),
            });
            break;
        }

        const subsetB: { name: string; price: number; addons: string[] }[] = [];
        let currentSubsetSum = 0;
        const indicesToRemove: number[] = [];

        for (let i = 0; i < remainingItems.length; i++) {
            if (currentSubsetSum + remainingItems[i].price <= 60000) {
                currentSubsetSum += remainingItems[i].price;
                subsetB.push(remainingItems[i]);
                indicesToRemove.push(i);
            }
        }

        if (currentSubsetSum >= 50000) {
            groups.push({
                id: generateId(),
                items: subsetB.map(i => ({ name: i.name, addons: i.addons, price: i.price, basePrice: i.price })),
                totalPrice: currentSubsetSum,
                recommendedVoucher: 'min50k',
                estimatedDiscount: calcKopKenDiscB(currentSubsetSum),
            });
            indicesToRemove.sort((a, b) => b - a).forEach(idx => remainingItems.splice(idx, 1));
        } else {
            const basketAItems: { name: string; price: number; addons: string[] }[] = [];
            let basketASum = 0;
            const removeA: number[] = [];

            for (let i = 0; i < remainingItems.length; i++) {
                if (basketASum + remainingItems[i].price <= 70000) {
                    basketASum += remainingItems[i].price;
                    basketAItems.push(remainingItems[i]);
                    removeA.push(i);
                }
            }

            if (basketAItems.length === 0 && remainingItems.length > 0) {
                const forcedItem = remainingItems[0];
                basketAItems.push(forcedItem);
                basketASum += forcedItem.price;
                removeA.push(0);
            }

            groups.push({
                id: generateId(),
                items: basketAItems.map(i => ({ name: i.name, addons: i.addons, price: i.price, basePrice: i.price })),
                totalPrice: basketASum,
                recommendedVoucher: 'nomin',
                estimatedDiscount: calcKopKenDiscA(basketASum),
            });
            removeA.sort((a, b) => b - a).forEach(idx => remainingItems.splice(idx, 1));
        }
    }

    return groups;
}

// ==========================================
// LOGIC 3: TOMORO COFFEE (BOGO & 50%)
// ==========================================

export function isTomoroEligible(name: string): boolean {
    return !/ice\s*cream|master\s*of\s*s\.?o\.?e|frappe|lto/i.test(name);
}

type TomoroItem = {
    name: string;
    price: number;
    basePrice: number;
    size?: 'small' | 'regular' | 'large';
    addons: string[];
    isEligible: boolean;
};

function expandTomoroItems(items: CartItem[]): TomoroItem[] {
    const expanded: TomoroItem[] = [];
    for (const item of items) {
        const bp = item.basePrice !== undefined && item.basePrice > 0 ? item.basePrice : item.price;
        const size = item.size || (/small/i.test(item.name) ? 'small' : (/large/i.test(item.name) ? 'large' : 'regular'));
        const eligible = isTomoroEligible(item.name) && size === 'small';
        const addons = item.addons ?? [];
        for (let i = 0; i < item.qty; i++) {
            expanded.push({
                name: item.name,
                price: item.price,
                basePrice: bp,
                size: size,
                addons: [...addons],
                isEligible: eligible,
            });
        }
    }
    return expanded;
}

function optimizeTomoro(
    expandedItems: TomoroItem[],
    accountCost: number
): OptimizedGroup[] {
    if (expandedItems.length === 0) return [];

    const eligibleItems = expandedItems.filter(i => i.isEligible);
    const maxK = Math.floor(eligibleItems.length / 2);

    let bestNetBenefit = -Infinity;
    let bestGroups: OptimizedGroup[] = [];

    for (let k = 0; k <= maxK; k++) {
        const result = simulateTomoroScenario(expandedItems, k, accountCost);
        if (result.netBenefit > bestNetBenefit) {
            bestNetBenefit = result.netBenefit;
            bestGroups = result.groups;
        }
    }

    return bestGroups;
}

function simulateTomoroScenario(
    allItems: TomoroItem[],
    k: number,
    accountCost: number
): { groups: OptimizedGroup[]; netBenefit: number } {
    const itemsWithIndex = allItems.map((item, idx) => ({ ...item, idx }));
    const eligibleWithIndex = itemsWithIndex.filter(i => i.isEligible);
    const sortedEligible = [...eligibleWithIndex].sort((a, b) => b.basePrice - a.basePrice);

    const groups: OptimizedGroup[] = [];
    let totalBogoDisc = 0;
    const usedIndices = new Set<number>();

    // Build k BOGO pairs
    for (let p = 0; p < k; p++) {
        if (sortedEligible.length - usedIndices.size < 2) break;

        let item1: typeof sortedEligible[0] | null = null;
        for (let i = 0; i < sortedEligible.length; i++) {
            if (!usedIndices.has(sortedEligible[i].idx)) {
                item1 = sortedEligible[i];
                break;
            }
        }
        if (!item1) break;

        let item2: typeof sortedEligible[0] | null = null;
        for (let i = 0; i < sortedEligible.length; i++) {
            if (!usedIndices.has(sortedEligible[i].idx) && sortedEligible[i].idx !== item1.idx) {
                item2 = sortedEligible[i];
                break;
            }
        }
        if (!item2) break;

        usedIndices.add(item1.idx);
        usedIndices.add(item2.idx);

        const triggerItem = item1.basePrice >= item2.basePrice ? item1 : item2;
        const freeItem = item1.basePrice >= item2.basePrice ? item2 : item1;
        const bogoDisc = freeItem.basePrice;
        totalBogoDisc += bogoDisc;

        groups.push({
            id: generateId(),
            items: [
                {
                    name: triggerItem.name,
                    addons: triggerItem.addons,
                    price: triggerItem.price,
                    basePrice: triggerItem.basePrice,
                    isBogoDFree: false,
                },
                {
                    name: freeItem.name,
                    addons: freeItem.addons,
                    price: freeItem.price,
                    basePrice: freeItem.basePrice,
                    isBogoDFree: true,
                },
            ],
            totalPrice: triggerItem.price + freeItem.price,
            recommendedVoucher: 'tomoro_bogo',
            estimatedDiscount: bogoDisc,
            bogoDiscount: bogoDisc,
        });
    }

    // Remaining items
    const remainingItems = itemsWithIndex.filter(i => !usedIndices.has(i.idx));
    let disc50 = 0;
    let has50Acct = false;

    if (remainingItems.length > 0) {
        const qualifyingItems = remainingItems.filter(i => i.isEligible && i.size === 'small');
        if (qualifyingItems.length > 0) {
            const prices = qualifyingItems.map(i => i.price);
            const maxPrice = Math.max(...prices);
            disc50 = maxPrice * 0.5;
        }

        if (disc50 > accountCost) {
            has50Acct = true;
            groups.push({
                id: generateId(),
                items: remainingItems.map(i => ({
                    name: i.name,
                    addons: i.addons,
                    price: i.price,
                    basePrice: i.basePrice,
                })),
                totalPrice: remainingItems.reduce((s, i) => s + i.price, 0),
                recommendedVoucher: 'tomoro_50',
                estimatedDiscount: disc50,
            });
        } else {
            groups.push({
                id: generateId(),
                items: remainingItems.map(i => ({
                    name: i.name,
                    addons: i.addons,
                    price: i.price,
                    basePrice: i.basePrice,
                })),
                totalPrice: remainingItems.reduce((s, i) => s + i.price, 0),
                recommendedVoucher: 'tomoro_50',
                estimatedDiscount: 0,
            });
            disc50 = 0;
        }
    }

    const totalDisc = totalBogoDisc + disc50;
    const totalAdminAccts = k + (has50Acct ? 1 : 0);
    const totalAdmin = totalAdminAccts * accountCost;
    const netBenefit = totalDisc - totalAdmin;

    return { groups, netBenefit };
}

// ==========================================
// LOGIC 4: KOPI JANJI JIWA (50% max 20k)
// ==========================================

function optimizeJanjiJiwa(
    expandedItems: { name: string; price: number; addons: string[] }[],
    accountCost: number
): OptimizedGroup[] {
    if (expandedItems.length === 0) return [];

    const total = expandedItems.reduce((a, b) => a + b.price, 0);
    const sorted = [...expandedItems].sort((a, b) => b.price - a.price);

    const maxG = Math.max(1, Math.ceil(total / 40000));
    let bestNetBenefit = -Infinity;
    let bestGroups: OptimizedGroup[] = [];

    for (let g = 1; g <= maxG; g++) {
        const baskets: OptimizedGroup[] = Array(g).fill(null).map(() => ({
            id: generateId(),
            items: [],
            totalPrice: 0,
            recommendedVoucher: 'jiwa_50' as const,
            estimatedDiscount: 0,
        }));

        for (const item of sorted) {
            baskets.sort((a, b) => a.totalPrice - b.totalPrice);
            baskets[0].items.push({
                name: item.name,
                addons: item.addons,
                price: item.price,
                basePrice: item.price,
            });
            baskets[0].totalPrice += item.price;
        }

        let totalDisc = 0;
        for (const b of baskets) {
            b.estimatedDiscount = Math.min(b.totalPrice * 0.5, 20000);
            totalDisc += b.estimatedDiscount;
        }

        const netBenefit = totalDisc - g * accountCost;
        if (netBenefit > bestNetBenefit) {
            bestNetBenefit = netBenefit;
            bestGroups = baskets;
        }
    }

    return bestGroups;
}

// --- MAIN EXPORT ---
export function optimizeOrder(
    items: CartItem[],
    brand: 'fore' | 'kopken' | 'tomoro' | 'janjijiwa',
    accountCost: number
): OptimizationResult {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return {
            groups: [],
            totalBill: 0,
            totalDiscount: 0,
            totalAdminCost: 0,
            finalPrice: 0,
            accountsNeeded: 0,
        };
    }

    try {
        let groups: OptimizedGroup[];
        let totalBill: number;

        if (brand === 'fore') {
            const foreItems = expandCartItems(items);
            totalBill = foreItems.reduce((s, i) => s + i.price, 0);
            groups = optimizeFore(foreItems);
        } else if (brand === 'kopken') {
            const kopItems = expandKopKenItems(items);
            totalBill = kopItems.reduce((s, i) => s + i.price, 0);
            groups = optimizeKopKen(kopItems);
        } else if (brand === 'tomoro') {
            const tomoroItems = expandTomoroItems(items);
            totalBill = tomoroItems.reduce((s, i) => s + i.price, 0);
            groups = optimizeTomoro(tomoroItems, accountCost);
        } else {
            const jiwaItems = expandKopKenItems(items); // Reuses expandKopKenItems as it is brand-agnostic
            totalBill = jiwaItems.reduce((s, i) => s + i.price, 0);
            groups = optimizeJanjiJiwa(jiwaItems, accountCost);
        }

        const totalDiscount = groups.reduce((sum, g) => sum + g.estimatedDiscount, 0);

        let accountsNeeded: number;
        let totalAdminCost: number;

        if (brand === 'kopken') {
            const nominCount = groups.filter(g => g.recommendedVoucher === 'nomin').length;
            const min50kCount = groups.filter(g => g.recommendedVoucher === 'min50k').length;
            accountsNeeded = Math.max(nominCount, min50kCount);
            totalAdminCost = accountsNeeded * accountCost;
        } else if (brand === 'fore') {
            // accountCost is "fee per cup" for Fore — every basket always carries a positive
            // discount now (no BOGO leftover group), so accountsNeeded is simply group count.
            accountsNeeded = groups.length;
            const totalQty = items.reduce((s, i) => s + i.qty, 0);
            totalAdminCost = accountCost * totalQty;
        } else if (brand === 'tomoro') {
            const noDiscountGroupsCount = groups.filter(g => g.estimatedDiscount === 0).length;
            const discountedGroupsCount = groups.length - noDiscountGroupsCount;
            accountsNeeded = discountedGroupsCount;
            totalAdminCost = discountedGroupsCount * accountCost;
        } else {
            accountsNeeded = groups.length;
            totalAdminCost = accountsNeeded * accountCost;
        }

        const finalPrice = totalBill - totalDiscount + totalAdminCost;

        return {
            groups,
            totalBill,
            totalDiscount,
            totalAdminCost,
            finalPrice,
            accountsNeeded,
        };
    } catch (error) {
        console.error('Optimization Critical Error:', error);
        const totalBill = items.reduce((s, i) => s + i.price * i.qty, 0);
        return {
            groups: [
                {
                    id: generateId(),
                    items: items.map(i => ({
                        name: i.name,
                        addons: i.addons,
                        price: i.price,
                        basePrice: i.basePrice ?? i.price,
                    })),
                    totalPrice: totalBill,
                    recommendedVoucher: brand === 'kopken' ? 'nomin' : brand === 'fore' ? 'fore_25pct' : brand === 'tomoro' ? 'tomoro_50' : 'jiwa_50',
                    estimatedDiscount: 0,
                },
            ],
            totalBill,
            totalDiscount: 0,
            totalAdminCost: accountCost,
            finalPrice: totalBill + accountCost,
            accountsNeeded: 1,
        };
    }
}
