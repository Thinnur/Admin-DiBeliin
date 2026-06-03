// =============================================================================
// DiBeliin Admin - Order Optimizer
// =============================================================================
// Implements optimization strategies for Fore Coffee and Kopi Kenangan.
//
// FORE COFFEE (Updated S&K):
//   - Skenario A: Diskon 35% x total actualPrice, maks Rp 50.000, 1 akun
//   - Skenario B: BOGO - tiap pasang butuh >=1 minuman (bukan Fore Deli) sbg trigger
//                 Diskon = basePrice item termurah dalam pasangan
//                 Tiap pasangan = 1 akun terpisah (admin Rp 5.000/akun)
//   - Strategi: Hybrid Exhaustive Search - coba semua k BOGO pairs + sisa ke 35%
//               Pilih k dengan Net Benefit tertinggi.
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
     * basePrice: harga Regular menu (untuk kalkulasi diskon BOGO).
     * Jika tidak diisi, dianggap sama dengan actualPrice.
     * Hanya relevan untuk Fore Coffee.
     */
    basePrice?: number;
    /**
     * isForeDeli: true jika item adalah kategori Fore Deli (makanan).
     * Fore Deli TIDAK bisa jadi trigger BOGO, tapi bisa jadi pasangan (partner).
     * Hanya relevan untuk Fore Coffee.
     */
    isForeDeli?: boolean;
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
        isForeDeli: boolean;
        /** If this item is the free one in a BOGO pair */
        isBogoDFree?: boolean;
    }[];
    totalPrice: number;
    recommendedVoucher: 'nomin' | 'min50k' | 'fore_35pct' | 'fore_bogo' | 'tomoro_bogo' | 'tomoro_50' | 'jiwa_50';
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
const FORE_ADMIN_COST = 5000;
const FORE_35PCT_MAX = 50000;
const FORE_35PCT_RATE = 0.35;

// --- Helper: Generate unique ID ---
const generateId = () => Math.random().toString(36).substring(2, 11);

// --- Helper: Expand cart items (qty > 1 becomes multiple unit items) ---
function expandCartItems(items: CartItem[]): {
    name: string;
    price: number;
    basePrice: number;
    isForeDeli: boolean;
    addons: string[];
}[] {
    const expanded: { name: string; price: number; basePrice: number; isForeDeli: boolean; addons: string[] }[] = [];
    for (const item of items) {
        const bp = item.basePrice !== undefined && item.basePrice > 0 ? item.basePrice : item.price;
        const fd = item.isForeDeli ?? isForeDeli(item.name);
        const addons = item.addons ?? [];
        for (let i = 0; i < item.qty; i++) {
            expanded.push({
                name: item.name,
                price: item.price,
                basePrice: bp,
                isForeDeli: fd,
                addons: [...addons],
            });
        }
    }
    return expanded;
}

/** Auto-detect Fore Deli from item name */
export function isForeDeli(name: string): boolean {
    return /fore\s*deli/i.test(name);
}

// ==========================================
// LOGIC 1: FORE (Hybrid Exhaustive Search)
// ==========================================

/**
 * Unit item expanded from a CartItem
 */
type ForeItem = {
    name: string;
    price: number;      // actualPrice per unit
    basePrice: number;  // basePrice per unit (for BOGO discount)
    isForeDeli: boolean;
    addons: string[];
};

/**
 * Calculate 35% discount on a list of items.
 * Returns the discount amount (capped at FORE_35PCT_MAX).
 */
function calc35Discount(items: ForeItem[]): number {
    const total = items.reduce((s, i) => s + i.price, 0);
    return Math.min(total * FORE_35PCT_RATE, FORE_35PCT_MAX);
}

/**
 * Fore Coffee Hybrid Exhaustive Search Optimizer.
 *
 * Strategy:
 *   For k = 0, 1, 2, ..., maxK:
 *     - Select k BOGO pairs (each pair: 1 trigger drink + 1 free item)
 *       -> The cheapest items (by actualPrice) are chosen as the "free" items first
 *       -> The trigger must be a non-ForeDeli drink (cheapest available)
 *     - Remaining items go to the 35% account (only if disc > admin cost)
 *     - Compute NetBenefit = (bogoDis + disc35) - ((k + hasDisc35Acct) x ADMIN_COST)
 *   Pick k with highest NetBenefit.
 */
function optimizeFore(expandedItems: ForeItem[]): OptimizedGroup[] {
    if (expandedItems.length === 0) return [];

    // Max possible BOGO pairs:
    //   - Need at least 1 drink (non-ForeDeli) per pair as trigger
    //   - Need 2 items total per pair
    const drinkCount = expandedItems.filter(i => !i.isForeDeli).length;
    const maxK = Math.min(Math.floor(expandedItems.length / 2), drinkCount);

    let bestNetBenefit = -Infinity;
    let bestGroups: OptimizedGroup[] = [];

    for (let k = 0; k <= maxK; k++) {
        const result = simulateForeScenario(expandedItems, k);
        if (result.netBenefit > bestNetBenefit) {
            bestNetBenefit = result.netBenefit;
            bestGroups = result.groups;
        }
    }

    return bestGroups;
}

function simulateForeScenario(
    allItems: ForeItem[],
    k: number
): { groups: OptimizedGroup[]; netBenefit: number } {
    // Sort ascending by basePrice - item dengan Regular price termurah yang gratis (BOGO rule)
    const sorted = [...allItems].sort((a, b) => a.basePrice - b.basePrice);

    const groups: OptimizedGroup[] = [];
    let totalBogoDisc = 0;
    const usedIndices = new Set<number>();

    // Build k BOGO pairs
    for (let p = 0; p < k; p++) {
        if (sorted.length - usedIndices.size < 2) break;

        // FREE ITEM = cheapest unused item (any type - minuman atau Fore Deli)
        let freeIdx = -1;
        for (let i = 0; i < sorted.length; i++) {
            if (!usedIndices.has(i)) { freeIdx = i; break; }
        }
        if (freeIdx === -1) break;

        // TRIGGER = cheapest unused drink (non-ForeDeli) that is NOT the free item
        // (within a pair, trigger >= free price because we sorted ascending)
        let triggerIdx = -1;
        for (let i = 0; i < sorted.length; i++) {
            if (!usedIndices.has(i) && i !== freeIdx && !sorted[i].isForeDeli) {
                triggerIdx = i;
                break;
            }
        }
        if (triggerIdx === -1) break; // No drink available as trigger

        usedIndices.add(freeIdx);
        usedIndices.add(triggerIdx);

        const freeItem = sorted[freeIdx];
        const triggerItem = sorted[triggerIdx];

        // BOGO discount = basePrice of the FREE (cheapest) item
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
                    isForeDeli: triggerItem.isForeDeli,
                    isBogoDFree: false,
                },
                {
                    name: freeItem.name,
                    addons: freeItem.addons,
                    price: freeItem.price,
                    basePrice: freeItem.basePrice,
                    isForeDeli: freeItem.isForeDeli,
                    isBogoDFree: true,
                },
            ],
            totalPrice: triggerItem.price + freeItem.price,
            recommendedVoucher: 'fore_bogo',
            estimatedDiscount: bogoDisc,
            bogoDiscount: bogoDisc,
        });
    }

    // Remaining items (not used in BOGO) -> 35% account (if enabled) or no voucher
    const remainingItems = sorted.filter((_, i) => !usedIndices.has(i));

    let disc35 = 0;
    let has35Acct = false;

    if (remainingItems.length > 0) {
        if (ENABLE_FORE_35PCT) {
            disc35 = calc35Discount(remainingItems);
            // Only add 35% account if the discount outweighs admin cost
            if (disc35 > FORE_ADMIN_COST) {
                has35Acct = true;
                const total35 = remainingItems.reduce((s, i) => s + i.price, 0);
                groups.push({
                    id: generateId(),
                    items: remainingItems.map(i => ({
                        name: i.name,
                        addons: i.addons,
                        price: i.price,
                        basePrice: i.basePrice,
                        isForeDeli: i.isForeDeli,
                    })),
                    totalPrice: total35,
                    recommendedVoucher: 'fore_35pct',
                    estimatedDiscount: disc35,
                });
            } else {
                // Items exist but no discount worth it - show as group with 0 discount (no voucher)
                const total35 = remainingItems.reduce((s, i) => s + i.price, 0);
                groups.push({
                    id: generateId(),
                    items: remainingItems.map(i => ({
                        name: i.name,
                        addons: i.addons,
                        price: i.price,
                        basePrice: i.basePrice,
                        isForeDeli: i.isForeDeli,
                    })),
                    totalPrice: total35,
                    recommendedVoucher: 'fore_35pct',
                    estimatedDiscount: 0,
                });
                disc35 = 0; // Not counted toward NetBenefit
            }
        } else {
            // 35% disabled -> show remaining items as a group with 0 discount under BOGO
            const total35 = remainingItems.reduce((s, i) => s + i.price, 0);
            groups.push({
                id: generateId(),
                items: remainingItems.map(i => ({
                    name: i.name,
                    addons: i.addons,
                    price: i.price,
                    basePrice: i.basePrice,
                    isForeDeli: i.isForeDeli,
                })),
                totalPrice: total35,
                recommendedVoucher: 'fore_bogo',
                estimatedDiscount: 0,
            });
        }
    }

    const totalDisc = totalBogoDisc + disc35;
    const totalAdminAccts = k + (has35Acct ? 1 : 0);
    const totalAdmin = totalAdminAccts * FORE_ADMIN_COST;
    const netBenefit = totalDisc - totalAdmin;

    return { groups, netBenefit };
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
                baskets[0].items.push({ name: item.name, addons: item.addons, price: item.price, basePrice: item.price, isForeDeli: false });
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
                items: remainingItems.map(i => ({ name: i.name, addons: i.addons, price: i.price, basePrice: i.price, isForeDeli: false })),
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
                items: remainingItems.map(i => ({ name: i.name, addons: i.addons, price: i.price, basePrice: i.price, isForeDeli: false })),
                totalPrice: currentTotal,
                recommendedVoucher: 'min50k',
                estimatedDiscount: calcKopKenDiscB(currentTotal),
            });
            break;
        }

        if (currentTotal < 50000 || (currentTotal > 60000 && currentTotal <= 70000)) {
            groups.push({
                id: generateId(),
                items: remainingItems.map(i => ({ name: i.name, addons: i.addons, price: i.price, basePrice: i.price, isForeDeli: false })),
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
                items: subsetB.map(i => ({ name: i.name, addons: i.addons, price: i.price, basePrice: i.price, isForeDeli: false })),
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
                items: basketAItems.map(i => ({ name: i.name, addons: i.addons, price: i.price, basePrice: i.price, isForeDeli: false })),
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
                    isForeDeli: false,
                    isBogoDFree: false,
                },
                {
                    name: freeItem.name,
                    addons: freeItem.addons,
                    price: freeItem.price,
                    basePrice: freeItem.basePrice,
                    isForeDeli: false,
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
                    isForeDeli: false,
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
                    isForeDeli: false,
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
                isForeDeli: false,
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
        if (brand === 'kopken') {
            const nominCount = groups.filter(g => g.recommendedVoucher === 'nomin').length;
            const min50kCount = groups.filter(g => g.recommendedVoucher === 'min50k').length;
            accountsNeeded = Math.max(nominCount, min50kCount);
        } else if (brand === 'fore' || brand === 'tomoro') {
            const noDiscountGroupsCount = groups.filter(g => g.estimatedDiscount === 0).length;
            accountsNeeded = groups.length - noDiscountGroupsCount;
        } else {
            accountsNeeded = groups.length;
        }

        const effectiveAdminCost = brand === 'fore' ? FORE_ADMIN_COST : accountCost;

        let totalAdminCost: number;
        if (brand === 'fore' || brand === 'tomoro') {
            const noDiscountGroupsCount = groups.filter(g => g.estimatedDiscount === 0).length;
            const discountedGroupsCount = groups.length - noDiscountGroupsCount;
            totalAdminCost = discountedGroupsCount * effectiveAdminCost;
            accountsNeeded = discountedGroupsCount;
        } else {
            totalAdminCost = accountsNeeded * effectiveAdminCost;
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
                        isForeDeli: i.isForeDeli ?? false,
                    })),
                    totalPrice: totalBill,
                    recommendedVoucher: brand === 'kopken' ? 'nomin' : brand === 'fore' ? (ENABLE_FORE_35PCT ? 'fore_35pct' : 'fore_bogo') : brand === 'tomoro' ? 'tomoro_50' : 'jiwa_50',
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
