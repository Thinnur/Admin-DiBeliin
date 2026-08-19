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

const KOPKEN_MIN50K_FLOOR = 50000;
const KOPKEN_MIN70K_FLOOR = 70000;

// Diskon per tier. min50k & min70k capnya SAMA (30rb), bedanya cuma ambang belanja.
// Dua konsekuensinya dipakai di bawah: (a) min70k selalu tepat 30rb, karena subtotal
// >=70rb bikin 50%-nya >=35rb sehingga pasti kena cap; (b) min50k tidak pernah masuk
// akal buat keranjang >=70rb -- diskonnya sama persis tapi makan kupon 2x lebih banyak.
const KOPKEN_DISCOUNT: Record<KopKenTier, (basketTotal: number) => number> = {
    nomin: t => Math.min(t * 0.5, 35000),
    min50k: t => (t >= KOPKEN_MIN50K_FLOOR ? Math.min(t * 0.5, 30000) : 0),
    min70k: t => (t >= KOPKEN_MIN70K_FLOOR ? Math.min(t * 0.5, 30000) : 0),
};

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

/**
 * Nilai terbaik dari satu cara membagi (net = total diskon - biaya admin), sekaligus
 * tier mana yang dipakai tiap keranjang. EKSAK dan O(k^2), bukan tebak-tebakan:
 *
 * Tiap keranjang jatuh ke satu dari tiga kelompok -- F (<50rb, mau tak mau nomin),
 * A (50-70rb, tier murahnya min50k, bobot 1 kupon), B (>=70rb, tier murahnya min70k,
 * bobot 1/2 kupon). Diskon nomin selalu >= tier murah, jadi satu-satunya keputusan
 * adalah "berapa keranjang A dan berapa keranjang B yang dinaikkan ke nomin" -- dan
 * untuk jumlah tertentu, jelas yang dinaikkan adalah yang selisih diskonnya terbesar.
 * Cukup enumerasi pasangan (a, b) lalu ambil selisih teratas lewat prefix sum.
 *
 * `totals` harus sudah bebas keranjang kosong; `tiers` yang dikembalikan sejajar dengannya.
 */
function kopKenScore(totals: number[], accountCost: number): { net: number; tiers: KopKenTier[] } {
    if (totals.length === 0) return { net: -Infinity, tiers: [] };

    const forced: number[] = [];
    const midRange: number[] = [];
    const highRange: number[] = [];
    totals.forEach((t, i) => {
        if (t >= KOPKEN_MIN70K_FLOOR) highRange.push(i);
        else if (t >= KOPKEN_MIN50K_FLOOR) midRange.push(i);
        else forced.push(i);
    });

    // Diskon kalau semua keranjang pakai tier termurahnya.
    let base = 0;
    for (const i of forced) base += KOPKEN_DISCOUNT.nomin(totals[i]);
    for (const i of midRange) base += KOPKEN_DISCOUNT.min50k(totals[i]);
    for (const i of highRange) base += KOPKEN_DISCOUNT.min70k(totals[i]);

    // Tambahan diskon kalau keranjang itu dinaikkan ke nomin, terbesar duluan.
    const midGain = (i: number) => KOPKEN_DISCOUNT.nomin(totals[i]) - KOPKEN_DISCOUNT.min50k(totals[i]);
    const highGain = (i: number) => KOPKEN_DISCOUNT.nomin(totals[i]) - KOPKEN_DISCOUNT.min70k(totals[i]);
    midRange.sort((x, y) => midGain(y) - midGain(x));
    highRange.sort((x, y) => highGain(y) - highGain(x));
    const midPrefix = [0];
    midRange.forEach((i, j) => midPrefix.push(midPrefix[j] + midGain(i)));
    const highPrefix = [0];
    highRange.forEach((i, j) => highPrefix.push(highPrefix[j] + highGain(i)));

    let bestNet = -Infinity;
    let bestMid = 0;
    let bestHigh = 0;
    for (let a = 0; a <= midRange.length; a++) {
        for (let b = 0; b <= highRange.length; b++) {
            const nomin = forced.length + a + b;
            const net = base + midPrefix[a] + highPrefix[b]
                - kopKenSlots(nomin, midRange.length - a, highRange.length - b) * accountCost;
            if (net > bestNet) {
                bestNet = net;
                bestMid = a;
                bestHigh = b;
            }
        }
    }

    const tiers: KopKenTier[] = totals.map(() => 'nomin');
    midRange.forEach((i, j) => { if (j >= bestMid) tiers[i] = 'min50k'; });
    highRange.forEach((i, j) => { if (j >= bestHigh) tiers[i] = 'min70k'; });
    return { net: bestNet, tiers };
}

/**
 * Tiga titik awal dengan BENTUK berbeda, karena hill climbing di optimizeKopKen cuma
 * sebagus titik awalnya. LPT membagi serata mungkin; dua "carve" sengaja membagi TIMPANG
 * -- isi satu keranjang sampai lewat 50rb, baru pindah ke keranjang berikutnya. Bentuk
 * timpang itu yang tidak akan pernah ditemukan LPT (lihat catatan regresi di optimizeKopKen).
 */
function kopKenSeeds(units: KopKenUnit[], k: number): number[][] {
    const lpt = new Array<number>(units.length).fill(0);
    const lptTotals = new Array<number>(k).fill(0);
    for (let i = 0; i < units.length; i++) {
        let b = 0;
        for (let j = 1; j < k; j++) if (lptTotals[j] < lptTotals[b]) b = j;
        lpt[i] = b;
        lptTotals[b] += units[i].price;
    }

    // units sudah urut dari termahal, jadi order[] menentukan carve dari besar atau kecil.
    const carve = (order: number[]): number[] => {
        const assign = new Array<number>(units.length).fill(0);
        const totals = new Array<number>(k).fill(0);
        let b = 0;
        for (const i of order) {
            if (totals[b] >= KOPKEN_MIN50K_FLOOR && b < k - 1) b++;
            assign[i] = b;
            totals[b] += units[i].price;
        }
        return assign;
    };
    const fromLargest = units.map((_, i) => i);
    const fromSmallest = [...fromLargest].reverse();
    return [lpt, carve(fromLargest), carve(fromSmallest)];
}

// Cari pembagian dengan NET terbaik (total diskon - biaya admin), bukan yang diskonnya
// terbesar. REWRITE 2026-08-19: versi lama (attemptAllMin50 + while-loop fallback +
// pickCheaper) tidak pernah menilai kandidatnya pakai kopKenSlots, dan itu bocor 3 arah:
//   (a) semua keranjang dipaksa min50k, termasuk yang >60rb -- di situ capnya bikin rugi
//       sampai 5rb dibanding nomin, sering tanpa nambah slot sama sekali;
//   (b) jumlah keranjang diambil mulai dari yang TERBANYAK lalu ambil yang pertama muat,
//       padahal keranjang terbanyak = admin termahal, dan jumlah ganjil membuang
//       setengah slot (5x min50k = 3 slot, 4x min50k = 2 slot);
//   (c) min70k tidak pernah dipakai sama sekali.
//
// PENTING -- kenapa ada hill climbing dan bukan cuma LPT: percobaan pertama rewrite ini
// cuma memakai pembagian LPT (serata mungkin), satu partisi per k. Itu REGRESI, ketahuan
// dari order nyata ORD-260819-07ED (25rb + 14rb + 19rb + 28rb = 86rb): LPT bikin
// 42rb + 44rb, dua-duanya di bawah 50rb sehingga dua-duanya wajib nomin = 2 slot, dan
// pencarian akhirnya malah memilih 1 keranjang 86rb (diskon kena cap 35rb, bayar 59rb).
// Yang benar justru pembagian TIMPANG: 33rb nomin + 53rb min50k -- satu keranjang sengaja
// didorong lewat ambang 50rb, diskon penuh 43rb dan tetap 1 slot, bayar 51rb. While-loop
// lama kebetulan menghasilkan bentuk timpang itu; LPT murni tidak akan pernah bisa.
// Karena itu: 3 titik awal berbentuk beda (kopKenSeeds) + hill climbing pindah/tukar unit.
// Diuji lawan brute force SEMUA partisi (scripts/verify-kenangan-pricing.mjs): 0 kalah.
function optimizeKopKen(expandedItems: KopKenUnit[], accountCost: number): OptimizedGroup[] {
    // unit.price is discountable-only (see expandKopKenItems) -- full() restores the real
    // amount for display (subtotal / line items) without letting non-discountable addons
    // (Syrup/Topping/Espresso Shot) leak into the 50% discount or the 50k/70k thresholds.
    const full = (u: KopKenUnit) => u.price + u.nonDiscountablePrice;
    const toDisplayItems = (units: KopKenUnit[]) =>
        units.map(u => ({ name: u.name, addons: u.addons, price: full(u), basePrice: full(u) }));
    const sumFull = (units: KopKenUnit[]) => units.reduce((s, u) => s + full(u), 0);

    if (expandedItems.length === 0) return [];

    const units = [...expandedItems].sort((a, b) => b.price - a.price);
    const discountableTotal = units.reduce((s, u) => s + u.price, 0);
    // Lebih banyak dari ini pasti menyisakan keranjang di bawah 50rb, yang wajib nomin
    // (1 slot penuh) demi diskon kecil -- selalu kalah dibanding digabung.
    const maxBaskets = Math.min(units.length, Math.floor(discountableTotal / KOPKEN_MIN50K_FLOOR) + 1);

    /** Total tiap keranjang; keranjang kosong (total 0) dibuang sebelum dinilai. */
    const scoreAssign = (assign: number[], k: number): number => {
        const totals = new Array<number>(k).fill(0);
        for (let i = 0; i < assign.length; i++) totals[assign[i]] += units[i].price;
        return kopKenScore(totals.filter(t => t > 0), accountCost).net;
    };

    let bestNet = -Infinity;
    let bestAssign = new Array<number>(units.length).fill(0);
    let bestK = 1;

    for (let k = 1; k <= maxBaskets; k++) {
        for (const seed of kopKenSeeds(units, k)) {
            const assign = seed;
            let net = scoreAssign(assign, k);

            // ponytail: hill climbing polos (pindah 1 unit, lalu tukar 2 unit) sampai tidak
            // ada perbaikan. Cukup untuk ukuran order nyata: order terbesar sepanjang
            // riwayat 488rb (20 unit, 10 keranjang) diukur ~13ms, sisanya jauh di bawah itu.
            // Kalau nanti ada order jauh lebih besar dan ini terasa lambat, batasi jumlah
            // pass atau update totals secara inkremental (sekarang dihitung ulang tiap tetangga).
            for (let pass = 0; pass < 20; pass++) {
                let improved = false;
                for (let i = 0; i < assign.length; i++) {
                    for (let b = 0; b < k; b++) {
                        if (b === assign[i]) continue;
                        const previous = assign[i];
                        assign[i] = b;
                        const candidate = scoreAssign(assign, k);
                        if (candidate > net) {
                            net = candidate;
                            improved = true;
                        } else {
                            assign[i] = previous;
                        }
                    }
                }
                for (let i = 0; i < assign.length; i++) {
                    for (let j = i + 1; j < assign.length; j++) {
                        if (assign[i] === assign[j]) continue;
                        const a = assign[i];
                        const b = assign[j];
                        assign[i] = b;
                        assign[j] = a;
                        const candidate = scoreAssign(assign, k);
                        if (candidate > net) {
                            net = candidate;
                            improved = true;
                        } else {
                            assign[i] = a;
                            assign[j] = b;
                        }
                    }
                }
                if (!improved) break;
            }

            if (net > bestNet) {
                bestNet = net;
                bestAssign = assign.slice();
                bestK = k;
            }
        }
    }

    const buckets: KopKenUnit[][] = Array.from({ length: bestK }, () => []);
    for (let i = 0; i < bestAssign.length; i++) buckets[bestAssign[i]].push(units[i]);
    const filled = buckets.filter(b => b.length > 0);
    const totals = filled.map(b => b.reduce((s, u) => s + u.price, 0));
    const { tiers } = kopKenScore(totals, accountCost);

    return filled.map((basket, i) => ({
        id: generateId(),
        items: toDisplayItems(basket),
        totalPrice: sumFull(basket),
        recommendedVoucher: tiers[i],
        estimatedDiscount: KOPKEN_DISCOUNT[tiers[i]](totals[i]),
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
    brand: 'fore' | 'kopken' | 'tomoro' | 'janjijiwa' | 'chatime',
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
