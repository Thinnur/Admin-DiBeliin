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
// KOPI KENANGAN: cari pembagian dengan NET terbaik (total diskon - biaya admin),
// lewat pencarian atas jumlah keranjang x pilihan tier tiap keranjang
// (nomin / min50k / min70k). Aturan biayanya ada di kopKenSlots: 1 biaya admin =
// 1 slot = maks 2 kupon, maks 1 di antaranya nomin, dan min70k cuma 1/2 kupon.

// --- Types ---

export interface CartItem {
    name: string;
    /** actualPrice: harga yang dibayar (Regular = harga regular, Large = harga Large) */
    price: number;
    qty: number;
    /** Porsi `price` (per-unit) yang tidak ikut diskon produk Kopken, mis. Syrup/Topping/
     * Espresso Shot — dikeluarkan dari basis diskon 50% di optimizeKopKen, sama seperti
     * getNonDiscountableAddonTotal di DIBeliin. */
    nonDiscountablePrice?: number;
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
    recommendedVoucher: 'nomin' | 'min50k' | 'min70k' | 'fore_25pct' | 'tomoro_bogo' | 'tomoro_50' | 'jiwa_50';
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
// LOGIC 2: KOPI KENANGAN (nomin / min50k / min70k)
// ==========================================

// price di unit yang di-expand adalah bagian DISCOUNTABLE saja (non-discountable addon
// dipisah ke field sendiri) -- match cara DIBeliin's CartItem.price sudah exclude addon
// non-discountable dari awal (lihat calculateGroupedPricing di pricingUtils.ts).
function expandKopKenItems(items: CartItem[]): { name: string; price: number; nonDiscountablePrice: number; addons: string[] }[] {
    const expanded: { name: string; price: number; nonDiscountablePrice: number; addons: string[] }[] = [];
    for (const item of items) {
        const ndp = Math.min(Math.max(0, item.nonDiscountablePrice ?? 0), item.price);
        for (let i = 0; i < item.qty; i++) {
            expanded.push({ name: item.name, price: item.price - ndp, nonDiscountablePrice: ndp, addons: item.addons ?? [] });
        }
    }
    return expanded;
}

type KopKenUnit = { name: string; price: number; nonDiscountablePrice: number; addons: string[] };

type KopKenTier = 'nomin' | 'min50k' | 'min70k';

// Diskon per tier. min50k & min70k capnya SAMA (30rb), bedanya cuma ambang belanja.
// Dua konsekuensinya dipakai di bawah: (a) min70k selalu tepat 30rb, karena subtotal
// >=70rb bikin 50%-nya >=35rb sehingga pasti kena cap; (b) min50k tidak pernah masuk
// akal buat keranjang >=70rb -- diskonnya sama persis tapi makan kupon 2x lebih banyak.
const KOPKEN_DISCOUNT: Record<KopKenTier, (basketTotal: number) => number> = {
    nomin: t => Math.min(t * 0.5, 35000),
    min50k: t => (t >= 50000 ? Math.min(t * 0.5, 30000) : 0),
    min70k: t => (t >= 70000 ? Math.min(t * 0.5, 30000) : 0),
};

/** Tier termurah yang valid buat satu keranjang. null = cuma nomin yang bisa dipakai. */
const kopKenCheapTier = (basketTotal: number): 'min50k' | 'min70k' | null =>
    basketTotal >= 70000 ? 'min70k' : basketTotal >= 50000 ? 'min50k' : null;

// Satu biaya admin (accountCost) = 1 "slot" yang menampung maks 2 kupon, maks 1 di
// antaranya boleh nomin. Bobot kupon: nomin & min50k = 1, min70k = 1/2. Jadi 1 slot =
// 1x nomin | 2x min50k | 1x nomin + 1x min50k | 4x min70k -- dan kelipatannya.
function kopKenSlots(nomin: number, min50k: number, min70k: number): number {
    return Math.max(nomin, Math.ceil((nomin + min50k + min70k / 2) / 2));
}

function kopKenAccountsAndAdminCost(groups: OptimizedGroup[], accountCost: number): { accountsNeeded: number; adminCost: number } {
    const count = (v: KopKenTier) => groups.filter(g => g.recommendedVoucher === v).length;
    const accountsNeeded = kopKenSlots(count('nomin'), count('min50k'), count('min70k'));
    return { accountsNeeded, adminCost: accountsNeeded * accountCost };
}

// Cari pembagian dengan NET terbaik (total diskon - biaya admin), bukan yang diskonnya
// terbesar. REWRITE 2026-08-18: versi lama (attemptAllMin50 + while-loop fallback +
// pickCheaper) tidak pernah menilai kandidatnya pakai kopKenSlots, dan itu bocor 3 arah:
//   (a) semua keranjang dipaksa min50k, termasuk yang >60rb -- di situ capnya bikin rugi
//       sampai 5rb dibanding nomin, sering tanpa nambah slot sama sekali;
//   (b) jumlah keranjang diambil mulai dari yang TERBANYAK lalu ambil yang pertama muat,
//       padahal keranjang terbanyak = admin termahal, dan jumlah ganjil membuang
//       setengah slot (5x min50k = 3 slot, 4x min50k = 2 slot);
//   (c) min70k tidak pernah dipakai sama sekali.
// Rugi terukur: 125rb -5rb, 175rb -7,5rb, 198rb -5rb, 250rb -3rb. Order <=120rb sudah
// benar sejak dulu. Pola pencarian di bawah menyamai optimizeTomoro/optimizeJanjiJiwa,
// yang memang sudah membandingkan netBenefit antar kandidat.
function optimizeKopKen(expandedItems: KopKenUnit[], accountCost: number): OptimizedGroup[] {
    // unit.price is discountable-only (see expandKopKenItems) -- full() restores the real
    // amount for display (subtotal / line items) without letting non-discountable addons
    // (Syrup/Topping/Espresso Shot) leak into the 50% discount or the 50k/70k thresholds.
    const full = (u: KopKenUnit) => u.price + u.nonDiscountablePrice;
    const toDisplayItems = (units: KopKenUnit[]) =>
        units.map(u => ({ name: u.name, addons: u.addons, price: full(u), basePrice: full(u) }));
    const sumFull = (units: KopKenUnit[]) => units.reduce((s, u) => s + full(u), 0);

    if (expandedItems.length === 0) return [];

    const sortedDesc = [...expandedItems].sort((a, b) => b.price - a.price);
    /** LPT: unit termahal duluan, selalu masuk ke keranjang yang paling kosong. */
    const packInto = (k: number): KopKenUnit[][] => {
        const baskets = Array.from({ length: k }, () => ({ units: [] as KopKenUnit[], total: 0 }));
        for (const u of sortedDesc) {
            baskets.sort((a, b) => a.total - b.total);
            baskets[0].units.push(u);
            baskets[0].total += u.price;
        }
        return baskets.map(b => b.units);
    };

    const discountableTotal = expandedItems.reduce((s, u) => s + u.price, 0);
    // Lebih banyak dari ini pasti menyisakan keranjang di bawah 50rb, yang wajib nomin
    // (1 slot penuh) demi diskon kecil -- selalu kalah dibanding digabung. Batas ini juga
    // yang menjaga enumerasi di bawah tetap kecil.
    const maxBaskets = Math.min(expandedItems.length, Math.floor(discountableTotal / 50000) + 1);

    let bestNet = -Infinity;
    let bestPlan: { units: KopKenUnit[]; total: number; tier: KopKenTier }[] = [];

    for (let k = 1; k <= maxBaskets; k++) {
        const baskets = packInto(k);
        const totals = baskets.map(b => b.reduce((s, u) => s + u.price, 0));
        const flex = totals
            .map((t, i) => ({ i, tier: kopKenCheapTier(t) }))
            .filter((f): f is { i: number; tier: 'min50k' | 'min70k' } => f.tier !== null);

        // ponytail: enumerasi 2^flex -- tiap keranjang yang memenuhi syarat cuma punya 2
        // pilihan (tier murahnya, atau nomin yang diskonnya lebih besar tapi makan 1 slot
        // penuh). flex <= discountableTotal/50rb, dan order terbesar sepanjang riwayat
        // 372rb => <=7 keranjang = 128 kombinasi, jadi ini murah. Guard 16 cuma jaga-jaga
        // kalau suatu saat ada order raksasa; di atas itu semua keranjang flex ambil tier
        // murahnya (hasilnya tetap valid, cuma tidak dijamin optimal).
        const combos = flex.length <= 16 ? 1 << flex.length : 1;
        for (let mask = 0; mask < combos; mask++) {
            const tiers: KopKenTier[] = totals.map(() => 'nomin');
            flex.forEach((f, j) => {
                if (combos === 1 || !(mask & (1 << j))) tiers[f.i] = f.tier;
            });

            let discount = 0;
            let nomin = 0;
            let min50k = 0;
            let min70k = 0;
            for (let i = 0; i < tiers.length; i++) {
                discount += KOPKEN_DISCOUNT[tiers[i]](totals[i]);
                if (tiers[i] === 'nomin') nomin++;
                else if (tiers[i] === 'min50k') min50k++;
                else min70k++;
            }

            const net = discount - kopKenSlots(nomin, min50k, min70k) * accountCost;
            if (net > bestNet) {
                bestNet = net;
                bestPlan = baskets.map((units, i) => ({ units, total: totals[i], tier: tiers[i] }));
            }
        }
    }

    return bestPlan.map(b => ({
        id: generateId(),
        items: toDisplayItems(b.units),
        totalPrice: sumFull(b.units),
        recommendedVoucher: b.tier,
        estimatedDiscount: KOPKEN_DISCOUNT[b.tier](b.total),
    }));
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
            // kopItems[].price is discountable-only (non-discountable addons split out) --
            // totalBill must reflect the FULL bill, so add nonDiscountablePrice back here.
            totalBill = kopItems.reduce((s, i) => s + i.price + i.nonDiscountablePrice, 0);
            groups = optimizeKopKen(kopItems, accountCost);
        } else if (brand === 'tomoro') {
            const tomoroItems = expandTomoroItems(items);
            totalBill = tomoroItems.reduce((s, i) => s + i.price, 0);
            groups = optimizeTomoro(tomoroItems, accountCost);
        } else {
            const jiwaItems = expandKopKenItems(items); // Reuses expandKopKenItems as it is brand-agnostic
            totalBill = jiwaItems.reduce((s, i) => s + i.price + i.nonDiscountablePrice, 0);
            groups = optimizeJanjiJiwa(jiwaItems, accountCost);
        }

        const totalDiscount = groups.reduce((sum, g) => sum + g.estimatedDiscount, 0);

        let accountsNeeded: number;
        let totalAdminCost: number;

        if (brand === 'kopken') {
            ({ accountsNeeded, adminCost: totalAdminCost } = kopKenAccountsAndAdminCost(groups, accountCost));
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
