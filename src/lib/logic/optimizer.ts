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
// (nomin / min50k / min70k). Aturan biayanya ada di kopKenAdminCost: 1 biaya admin =
// 1 slot = maks 2 kupon, maks 1 di antaranya nomin; min70k mengisi kursi kosong gratis,
// sisanya biaya sendiri per voucher.

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
    recommendedVoucher: 'nomin' | 'min50k' | 'min70k' | 'fore_25pct' | TomoroVoucher | JiwaVoucher;
    /** Tomoro/Janji Jiwa: akun ke-berapa yang dipakai order ini (satu akun bisa beberapa order). */
    account?: number;
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
// akal buat keranjang >=70rb -- diskonnya sama, dan min70k bisa mengisi kursi mana pun
// yang bisa diisi min50k, jadi biayanya tak pernah lebih mahal.
const KOPKEN_DISCOUNT: Record<KopKenTier, (basketTotal: number) => number> = {
    nomin: t => Math.min(t * 0.5, 35000),
    min50k: t => (t >= KOPKEN_MIN50K_FLOOR ? Math.min(t * 0.5, 30000) : 0),
    min70k: t => (t >= KOPKEN_MIN70K_FLOOR ? Math.min(t * 0.5, 30000) : 0),
};

// Satu biaya admin (accountCost) = 1 "slot" yang menampung maks 2 kupon nomin/min50k,
// maks 1 di antaranya boleh nomin: 1x nomin | 2x min50k | 1x nomin + 1x min50k.
// min70k mengisi kursi kosong di slot itu tanpa biaya tambahan (1 nomin + 1 min70k = 1 slot,
// sama seperti 1 nomin + 1 min50k); min70k sisanya kena min70kCost per voucher (default 3rb).
// Sengaja murah (2026-09-13) -- tiap ambil akun dapat nomin/min50k/min70k sama banyak, jadi
// min70k numpuk; di 3rb, keranjang >=70rb memilih min70k (seri dengan nomin) dan nomin awet.
// Harus identik dengan kenanganSlots/kenanganAdminCost di DIBeliin/src/utils/pricingUtils.ts.
function kopKenSlots(nomin: number, min50k: number): number {
    return Math.max(nomin, Math.ceil((nomin + min50k) / 2));
}

/** min70k yang tidak kebagian kursi kosong di slot nomin/min50k. */
function kopKenExtraMin70k(nomin: number, min50k: number, min70k: number): number {
    return Math.max(0, min70k - (2 * kopKenSlots(nomin, min50k) - nomin - min50k));
}

function kopKenAdminCost(nomin: number, min50k: number, min70k: number, accountCost: number, min70kCost: number): number {
    const extra = kopKenExtraMin70k(nomin, min50k, min70k);
    // Sepasang min70k sisa boleh buka slot baru kalau itu lebih murah (min70kCost > setengah slot).
    return kopKenSlots(nomin, min50k) * accountCost
        + Math.floor(extra / 2) * Math.min(2 * min70kCost, accountCost)
        + (extra % 2) * Math.min(min70kCost, accountCost);
}

function kopKenAccountsAndAdminCost(groups: OptimizedGroup[], accountCost: number, min70kCost: number): { accountsNeeded: number; adminCost: number } {
    const count = (v: KopKenTier) => groups.filter(g => g.recommendedVoucher === v).length;
    return {
        accountsNeeded: kopKenSlots(count('nomin'), count('min50k')) + kopKenExtraMin70k(count('nomin'), count('min50k'), count('min70k')),
        adminCost: kopKenAdminCost(count('nomin'), count('min50k'), count('min70k'), accountCost, min70kCost),
    };
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
function kopKenScore(totals: number[], accountCost: number, min70kCost: number, noNomin = false): { net: number; tiers: KopKenTier[] } {
    if (totals.length === 0) return { net: -Infinity, tiers: [] };
    if (noNomin) return kopKenScoreNoNomin(totals, accountCost, min70kCost);

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
            // Strict `>` di bawah: kalau seri, tetap di tier murah (lebih banyak min70k).
            const net = base + midPrefix[a] + highPrefix[b]
                - kopKenAdminCost(nomin, midRange.length - a, highRange.length - b, accountCost, min70kCost);
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
 * Mode voucher min 50/70 (app_settings.kopken_mode_min50_70): nomin habis, jadi tiap keranjang
 * langsung ke tier ambangnya. Keranjang < 50rb tidak bisa dibayar voucher apa pun -- dicatat min50k
 * (diskon 0) dengan penalti besar + selisihnya, supaya hill climbing tetap punya arah menjauhinya
 * dan pembagian yang punya keranjang begitu selalu kalah dari 1 keranjang utuh (kalau total >= 50rb).
 * Harus identik dengan kenanganScoreNoNomin di DIBeliin/src/utils/pricingUtils.ts.
 */
function kopKenScoreNoNomin(totals: number[], accountCost: number, min70kCost: number): { net: number; tiers: KopKenTier[] } {
    const tiers: KopKenTier[] = totals.map(t => (t >= KOPKEN_MIN70K_FLOOR ? 'min70k' : 'min50k'));
    const min70k = tiers.filter(t => t === 'min70k').length;
    let net = -kopKenAdminCost(0, totals.length - min70k, min70k, accountCost, min70kCost);
    totals.forEach((t, i) => {
        net += t >= KOPKEN_MIN50K_FLOOR ? KOPKEN_DISCOUNT[tiers[i]](t) : -(1e6 + KOPKEN_MIN50K_FLOOR - t);
    });
    return { net, tiers };
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
function optimizeKopKen(expandedItems: KopKenUnit[], accountCost: number, min70kCost: number, noNomin = false): OptimizedGroup[] {
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
        return kopKenScore(totals.filter(t => t > 0), accountCost, min70kCost, noNomin).net;
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
    const { tiers } = kopKenScore(totals, accountCost, min70kCost, noNomin);

    return filled.map((basket, i) => ({
        id: generateId(),
        items: toDisplayItems(basket),
        totalPrice: sumFull(basket),
        recommendedVoucher: tiers[i],
        estimatedDiscount: KOPKEN_DISCOUNT[tiers[i]](totals[i]),
    }));
}

// ==========================================
// LOGIC 3 & 4: TOMORO & KOPI JANJI JIWA — akun kopsu baru (2026-10-26)
// Satu biaya admin = satu akun = gabungan voucher; satu order = satu voucher.
// Blok di bawah ini (TOMORO_NO_VOUCHER s.d. planJanjiJiwa) SALINAN PERSIS dari
// DIBeliin/src/utils/pricingUtils.ts — ubah di sana lalu salin ke sini; paritasnya dijaga
// DIBeliin/scripts/verify-tomoro-jiwa-pricing.mjs.
// ==========================================

const TOMORO_NO_VOUCHER = /ice\s*cream|master\s*of\s*s\.?o\.?e|frappe|lto|nailoong|dino-?mite/i;
export const isTomoroEligible = (name: string): boolean => !TOMORO_NO_VOUCHER.test(name);

type TomoroVoucher = 'tomoro_bogo' | 'tomoro_50' | 'tomoro_10k' | 'tomoro_5k' | 'tomoro_3k' | 'tomoro_none';
type JiwaVoucher = 'jiwa_50_baru' | 'jiwa_50';
const TOMORO_FLAT: { type: TomoroVoucher; min: number; discount: number }[] = [
    { type: 'tomoro_10k', min: 30000, discount: 10000 },
    { type: 'tomoro_5k', min: 25000, discount: 5000 },
    { type: 'tomoro_3k', min: 20000, discount: 3000 },
];
export type TomoroPlanUnit = { price: number; basePrice: number; eligible: boolean };
export type PlanGroup<T> = { type: T; units: number[]; total: number; discount: number };
export type VoucherPlan<T> = { groups: PlanGroup<T>[]; accounts: number; discount: number };

/**
 * Per akun Tomoro: 1x B1G1 (2 unit, yang termurah gratis seharga basePrice-nya), 1x 50% (1 unit),
 * 1x tiap potongan Rp10/5/3rb (total order >= 30/25/20rb). Unit tak eligible masuk order tanpa voucher.
 * B1G1 & 50% dipilih eksak (DP atas unit urut termahal); potongan Rp dibagi serakah dari sisanya:
 * tak pernah menjanjikan diskon yang tak tercapai, paling-paling sedikit di bawah optimal.
 */
export function planTomoro(units: TomoroPlanUnit[], fee: number): VoucherPlan<TomoroVoucher> {
    const elig = units.map((_, i) => i).filter(i => units[i].eligible)
        .sort((a, b) => units[b].price - units[a].price || units[b].basePrice - units[a].basePrice || a - b);
    const n = elig.length;
    const groupOf = (type: TomoroVoucher, idx: number[], discount: number): PlanGroup<TomoroVoucher> =>
        ({ type, units: idx, total: idx.reduce((t, i) => t + units[i].price, 0), discount });
    let best: VoucherPlan<TomoroVoucher> = { groups: [], accounts: 0, discount: 0 };
    let bestNet = 0;
    // Sampai n akun: dua voucher 50% dari dua akun kadang lebih untung dari satu B1G1 (21rb+26rb).
    for (let k = 1; k <= n; k++) {
        // Peran tiap unit: 0 tanpa voucher, 1 = 50%, 2 = pembuka B1G1, 3 = penutup B1G1 (yang gratis).
        const W = k + 1;
        const at = (i: number, p: number, s: number, o: number) => ((i * W + p) * W + s) * 2 + o;
        const val = new Float64Array((n + 1) * W * W * 2).fill(-Infinity);
        const how = new Int8Array(val.length);
        const relax = (to: number, v: number, h: number) => { if (v > val[to]) { val[to] = v; how[to] = h; } };
        val[at(0, 0, 0, 0)] = 0;
        for (let i = 0; i < n; i++) {
            const u = units[elig[i]];
            for (let p = 0; p <= k; p++) for (let s = 0; s <= k; s++) for (let o = 0; o < 2; o++) {
                const v = val[at(i, p, s, o)];
                if (v === -Infinity) continue;
                relax(at(i + 1, p, s, o), v, 0);
                if (s < k) relax(at(i + 1, p, s + 1, o), v + u.price * 0.5, 1);
                if (!o && p < k) relax(at(i + 1, p, s, 1), v, 2);
                if (o) relax(at(i + 1, p + 1, s, 0), v + u.basePrice, 3);
            }
        }
        let p = 0, s = 0, o = 0;
        for (let pp = 0; pp <= k; pp++) for (let ss = 0; ss <= k; ss++) if (val[at(n, pp, ss, 0)] > val[at(n, p, s, 0)]) { p = pp; s = ss; }
        const role = new Array<number>(n);
        for (let i = n; i > 0; i--) {
            const h = how[at(i, p, s, o)];
            role[i - 1] = h;
            if (h === 1) s--;
            else if (h === 2) o = 0;
            else if (h === 3) { p--; o = 1; }
        }

        const groups: PlanGroup<TomoroVoucher>[] = [];
        const left: number[] = []; // urut termahal
        let top = -1;
        for (let i = 0; i < n; i++) {
            const u = elig[i];
            if (role[i] === 1) groups.push(groupOf('tomoro_50', [u], units[u].price * 0.5));
            else if (role[i] === 2) top = u;
            else if (role[i] === 3) groups.push(groupOf('tomoro_bogo', [top, u], units[u].basePrice));
            else left.push(u);
        }
        for (const f of TOMORO_FLAT) {
            for (let c = 0; c < k && left.length; c++) {
                // Termurah yang sendirian sudah cukup; kalau tak ada, gabung dari yang termahal.
                const pick = [...left].reverse().filter(i => units[i].price >= f.min).slice(0, 1);
                if (!pick.length) {
                    let t = 0;
                    for (const i of left) { pick.push(i); t += units[i].price; if (t >= f.min) break; }
                    if (t < f.min) break;
                }
                for (const i of pick) left.splice(left.indexOf(i), 1);
                groups.push(groupOf(f.type, pick, f.discount));
            }
        }

        const perType: Record<string, number> = {};
        for (const g of groups) perType[g.type] = (perType[g.type] ?? 0) + 1;
        const accounts = Math.max(0, ...Object.values(perType));
        const discount = groups.reduce((t, g) => t + g.discount, 0);
        if (discount - accounts * fee > bestNet) {
            bestNet = discount - accounts * fee;
            best = { groups, accounts, discount };
        }
    }
    const used = new Set(best.groups.flatMap(g => g.units));
    const rest = units.map((_, i) => i).filter(i => !used.has(i));
    if (rest.length) best.groups.push(groupOf('tomoro_none', rest, 0));
    return best;
}

/**
 * Per akun Janji Jiwa: 1x 50% Pengguna Baru (total >= 25rb, maks 50rb) + 1x 50% Referral (maks 20rb).
 * Harga menu sudah termasuk pajak. Dicoba k akun x nb voucher baru; unit (termahal dulu) masuk keranjang
 * yang paling jauh dari titik jenuhnya (100rb / 40rb). nb = 0 = skema lama (50% maks 20rb per akun).
 */
export function planJanjiJiwa(prices: number[], fee: number): VoucherPlan<JiwaVoucher> {
    const order = prices.map((_, i) => i).sort((a, b) => prices[b] - prices[a] || a - b);
    const maxK = Math.max(1, Math.ceil(prices.reduce((t, p) => t + p, 0) / 40000));
    let best: VoucherPlan<JiwaVoucher> = { groups: [], accounts: 0, discount: 0 };
    let bestNet = -Infinity;
    for (let k = 1; k <= maxK; k++) for (let nb = 0; nb <= k; nb++) {
        const baskets = [
            ...Array.from({ length: nb }, () => ({ type: 'jiwa_50_baru' as JiwaVoucher, cap: 100000, units: [] as number[], total: 0, discount: 0 })),
            ...Array.from({ length: k }, () => ({ type: 'jiwa_50' as JiwaVoucher, cap: 40000, units: [] as number[], total: 0, discount: 0 })),
        ];
        for (const i of order) {
            let b = baskets[0];
            for (const c of baskets) if (c.cap - c.total > b.cap - b.total) b = c;
            b.units.push(i);
            b.total += prices[i];
        }
        const used = baskets.filter(b => b.units.length);
        for (const b of used) b.discount = b.type === 'jiwa_50_baru' ? (b.total >= 25000 ? Math.min(b.total * 0.5, 50000) : 0) : Math.min(b.total * 0.5, 20000);
        if (used.some(b => b.discount === 0)) continue; // voucher baru di bawah minimal 25rb: susunan tak sah
        const accounts = Math.max(used.filter(b => b.type === 'jiwa_50_baru').length, used.filter(b => b.type === 'jiwa_50').length);
        const discount = used.reduce((t, b) => t + b.discount, 0);
        if (discount - accounts * fee > bestNet) {
            bestNet = discount - accounts * fee;
            best = { groups: used.map(({ type, units, total, discount }) => ({ type, units, total, discount })), accounts, discount };
        }
    }
    return best;
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

/** Rencana voucher -> grup kalkulator. `account` = urutan grup di jenis vouchernya (order ke-2 B1G1 = akun 2). */
function toOptimizedGroups(
    plan: VoucherPlan<TomoroVoucher | JiwaVoucher>,
    units: { name: string; price: number; basePrice: number; addons: string[] }[]
): OptimizedGroup[] {
    const perType: Record<string, number> = {};
    return plan.groups.map(g => ({
        id: generateId(),
        items: g.units.map((i, j) => ({
            name: units[i].name,
            addons: units[i].addons,
            price: units[i].price,
            basePrice: units[i].basePrice,
            ...(g.type === 'tomoro_bogo' ? { isBogoDFree: j === 1 } : {}),
        })),
        totalPrice: g.total,
        recommendedVoucher: g.type,
        estimatedDiscount: g.discount,
        ...(g.type === 'tomoro_bogo' ? { bogoDiscount: g.discount } : {}),
        account: g.type === 'tomoro_none' ? undefined : (perType[g.type] = (perType[g.type] ?? 0) + 1),
    }));
}

// ==========================================
// LOGIC 5: CHATIME (50% max 20k per akun, skema lama Janji Jiwa)
// ==========================================

function optimizeChatime(
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
    accountCost: number,
    /** Kopken saja: biaya admin per voucher min70k (app_settings.fee_jasdor_kopken_min70k). */
    min70kCost: number = 3000,
    /** Kopken saja: mode voucher min 50/70 (app_settings.kopken_mode_min50_70). */
    noNomin: boolean = false
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
            groups = optimizeKopKen(kopItems, accountCost, min70kCost, noNomin);
        } else if (brand === 'tomoro') {
            const tomoroItems = expandTomoroItems(items);
            totalBill = tomoroItems.reduce((s, i) => s + i.price, 0);
            const units = tomoroItems.map(i => ({ price: i.price, basePrice: i.basePrice, eligible: i.isEligible }));
            groups = toOptimizedGroups(planTomoro(units, accountCost), tomoroItems);
        } else if (brand === 'janjijiwa') {
            const jiwaItems = expandKopKenItems(items); // Reuses expandKopKenItems as it is brand-agnostic
            totalBill = jiwaItems.reduce((s, i) => s + i.price + i.nonDiscountablePrice, 0);
            groups = toOptimizedGroups(planJanjiJiwa(jiwaItems.map(i => i.price), accountCost), jiwaItems.map(i => ({ ...i, basePrice: i.price })));
        } else {
            const jiwaItems = expandKopKenItems(items);
            totalBill = jiwaItems.reduce((s, i) => s + i.price + i.nonDiscountablePrice, 0);
            groups = optimizeChatime(jiwaItems, accountCost);
        }

        const totalDiscount = groups.reduce((sum, g) => sum + g.estimatedDiscount, 0);

        let accountsNeeded: number;
        let totalAdminCost: number;

        if (brand === 'kopken') {
            ({ accountsNeeded, adminCost: totalAdminCost } = kopKenAccountsAndAdminCost(groups, accountCost, min70kCost));
        } else if (brand === 'fore') {
            // accountCost is "fee per cup" for Fore — every basket always carries a positive
            // discount now (no BOGO leftover group), so accountsNeeded is simply group count.
            accountsNeeded = groups.length;
            const totalQty = items.reduce((s, i) => s + i.qty, 0);
            totalAdminCost = accountCost * totalQty;
        } else if (brand === 'tomoro' || brand === 'janjijiwa') {
            accountsNeeded = Math.max(0, ...groups.map(g => g.account ?? 0));
            totalAdminCost = accountsNeeded * accountCost;
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
