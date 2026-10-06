// =============================================================================
// DiBeliin Admin - Checkout Job Service
// =============================================================================
// Job queue buat tombol "Proses Checkout" di Calculator (brand kopken & fore).
// Insert row di sini -> checkout_worker.js (pm2, server automation) yang polling
// & jalanin runCheckout()/runCheckoutFore() sesuai order_payload.brand, stream
// progress ke kolom `log`.

import { supabase } from '@/lib/supabase';

export type CheckoutJobStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export interface CheckoutJobOrderItem {
    name: string;
    options: string[];
    /** Catatan bebas per item (mis. dari baris "Catatan:" WA order) — diteruskan ke orderNotes di runCheckout.js. */
    notes?: string;
    /** Fore: jumlah cup. Kopken mengulang item, Fore pakai cartpd_qty. */
    qty?: number;
}

export interface CheckoutJobOrderPayload {
    /** Menentukan runner mana yang dipakai checkout_worker.js: 'kopken' ->
     * runCheckout.js, 'fore' -> runCheckoutFore.js. Sengaja di dalam payload,
     * bukan kolom tersendiri — checkout_jobs tidak punya kolom `brand` dan
     * payload lama (tanpa field ini) tetap dibaca sebagai kopken. */
    brand?: 'kopken' | 'fore';
    /** Fore: nomor akun yang dipakai. Boleh kosong kalau di server cuma ada
     * satu sesi Fore tersimpan (lihat fore_session.js). */
    phone?: string;
    /** Fore: nama metode bayar, dicocokkan ke user/order/list-payment. Default QRIS. */
    payment?: string;
    /** Kopken: 'qris' (default) atau 'blu'. Dipetakan ke paymentMethodCode
     * 10461/10369 di runCheckout.js — kopsu.app cuma menawarkan dua ini. */
    paymentMethod?: 'qris' | 'blu';
    /** Kopken + blu: nomor HP terdaftar di aplikasi blu (tanpa 0 di depan,
     * mis. 85894628645) — tagihan dikirim ke sini. Wajib kalau
     * paymentMethod === 'blu'. Default-nya dari app_settings.kopken_blu_account. */
    bluAccount?: string;
    outlet: string;
    name: string;
    voucher?: string;
    accountId?: string;
    subtotal: number;
    items: CheckoutJobOrderItem[];
    /** Jadwal pengambilan: "HH:MM" (24 jam, hari ini) buat "Jadwalkan", atau
     * kosongkan buat "Pickup Sekarang". Diteruskan apa adanya ke runCheckout.js. */
    pickupTime?: string;
    /** Sertakan kantong plastik? Default false. Kopken: needPackaging di runCheckout.js.
     * Fore: cart_data.paper_bag di runCheckoutFore.js (+Rp3.000). */
    needPackaging?: boolean;
    /** Nomor pesanan (qris_orders.order_number) yang menjadi asal job ini —
     * cuma metadata tampilan, tidak dipakai runCheckout.js. */
    orderNumber?: string;
    /** Akun/grup ke berapa dari total split pesanan ini (1-based) — metadata tampilan. */
    groupIndex?: number;
    /** Total akun/grup dari pesanan ini — metadata tampilan. */
    groupTotal?: number;
}

export interface CheckoutJobLogEntry {
    ts: string;
    msg: string;
}

export interface CheckoutJob {
    id: string;
    order_payload: CheckoutJobOrderPayload;
    status: CheckoutJobStatus;
    log: CheckoutJobLogEntry[];
    result: Record<string, unknown> | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    receipt_refresh_requested_at: string | null;
    cancel_requested_at: string | null;
}

export async function createCheckoutJob(
    payload: CheckoutJobOrderPayload,
    createdBy?: string
): Promise<CheckoutJob> {
    const { data, error } = await supabase
        .from('checkout_jobs')
        .insert({ order_payload: payload, created_by: createdBy ?? null })
        .select('*')
        .single();

    if (error) throw new Error(`Gagal membuat checkout job: ${error.message}`);
    return data as CheckoutJob;
}

export async function getCheckoutJob(id: string): Promise<CheckoutJob> {
    const { data, error } = await supabase
        .from('checkout_jobs')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw new Error(`Gagal memuat checkout job: ${error.message}`);
    return data as CheckoutJob;
}

/** Minta payment_status_worker.js ambil ulang struk (struk otomatis diambil begitu order
 * dibuat — sebelum dibayar — jadi belum ada nomor antrian/QR pickup di dalamnya). */
export async function requestReceiptRefresh(id: string): Promise<void> {
    const { error } = await supabase
        .from('checkout_jobs')
        .update({ receipt_refresh_requested_at: new Date().toISOString() })
        .eq('id', id);

    if (error) throw new Error(`Gagal minta refresh struk: ${error.message}`);
}

/** Riwayat checkout (buat halaman CheckoutHistory), cuma ringkasan:
 * - tanpa kolom `log` (array progres checkout_worker.js, bisa gede);
 * - dari `result` cuma amount/paymentStatus/phase -- struk (`receipt`) itu
 *   separuh ukuran baris dan tidak dipakai di daftar;
 * - `day` (yyyy-MM-dd, jam lokal) -> order hari itu saja; null -> `limit`
 *   order terbaru. Dulu selalu 2000 baris (~6,4 MB) tiap buka halaman.
 * Buka detail per-job (CheckoutProcess) tetap select('*'). */
export async function listCheckoutJobs(
    { day = null, limit = 300 }: { day?: string | null; limit?: number } = {}
): Promise<CheckoutJob[]> {
    let query = supabase
        .from('checkout_jobs')
        .select('id, order_payload, status, amount:result->amount, paymentStatus:result->>paymentStatus, phase:result->>phase, created_by, created_at, updated_at, receipt_refresh_requested_at, cancel_requested_at')
        .order('created_at', { ascending: false });

    if (day) {
        const mulai = new Date(`${day}T00:00:00`);
        const besok = new Date(mulai);
        besok.setDate(besok.getDate() + 1);
        // ponytail: batas 1000 per hari cuma jaring pengaman, rekor harian jauh di bawahnya
        query = query.gte('created_at', mulai.toISOString()).lt('created_at', besok.toISOString()).limit(1000);
    } else {
        query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Gagal memuat riwayat checkout: ${error.message}`);
    return (data ?? []).map(({ amount, paymentStatus, phase, ...j }) => ({
        ...j,
        result: { amount, paymentStatus, phase },
        log: [],
    })) as unknown as CheckoutJob[];
}

/** Batalkan job yang belum sampai Bayar. Dua kondisi:
 *  - Masih 'pending' (belum diklaim worker manapun) -> langsung tandai 'cancelled',
 *    klaim atomik (WHERE status='pending') biar gak ketuker sama worker yang
 *    kebetulan lagi ngeklaim di detik yang sama.
 *  - Udah 'running' (lagi diproses worker) -> gak bisa distop dari luar proses
 *    Node yang lagi jalan, jadi cuma titip flag `cancel_requested_at`;
 *    runCheckout.js ngecek flag ini di beberapa checkpoint SEBELUM submit
 *    order/Bayar (lihat checkCancelled() di sana) dan berhenti sendiri kalau
 *    keisi -- checkout_worker.js yang nyimpen status:'cancelled' akhirnya.
 * Return 'cancelled' (langsung berhasil) atau 'cancel_requested' (nunggu worker
 * berhenti di checkpoint berikutnya). */
export async function cancelCheckoutJob(id: string): Promise<'cancelled' | 'cancel_requested'> {
    const { data, error } = await supabase
        .from('checkout_jobs')
        .update({ status: 'cancelled', result: { cancelled: true }, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'pending')
        .select();
    if (error) throw new Error(`Gagal membatalkan: ${error.message}`);
    if ((data?.length ?? 0) > 0) return 'cancelled';

    const { error: reqError } = await supabase
        .from('checkout_jobs')
        .update({ cancel_requested_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'running');
    if (reqError) throw new Error(`Gagal minta pembatalan: ${reqError.message}`);
    return 'cancel_requested';
}

/** Hapus permanen: baris checkout_jobs + foto struk terkait di storage bucket
 * `checkout-receipts` (nama file selalu "Receipt_<orderId>.png", lihat
 * checkout_worker.js/payment_status_worker.js). Gagal hapus foto TIDAK
 * menggagalkan hapus baris DB — cuma di-log (mis. struk emang belum sempat ada). */
export async function deleteCheckoutJobs(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const { data: jobs, error: fetchError } = await supabase
        .from('checkout_jobs')
        .select('id, result')
        .in('id', ids);
    if (fetchError) throw new Error(`Gagal ambil data sebelum hapus: ${fetchError.message}`);

    const receiptFiles = (jobs ?? [])
        .map((j) => (j.result as { orderId?: string } | null)?.orderId)
        .filter((orderId): orderId is string => !!orderId)
        .map((orderId) => `Receipt_${orderId}.png`);

    if (receiptFiles.length > 0) {
        const { error: storageError } = await supabase.storage.from('checkout-receipts').remove(receiptFiles);
        if (storageError) console.warn('Sebagian foto struk gagal dihapus:', storageError.message);
    }

    const { error: deleteError } = await supabase.from('checkout_jobs').delete().in('id', ids);
    if (deleteError) throw new Error(`Gagal hapus riwayat: ${deleteError.message}`);
}

// -----------------------------------------------------------------------------
// Status akun Fore (chip di halaman Pesanan Baru)
// -----------------------------------------------------------------------------
// Ditulis fore_status_worker.js di HP ke app_settings tiap ~15 detik (minimal
// sekali semenit walau tidak berubah). Admin tidak bisa bertanya langsung ke
// Fore: tokennya cuma ada di server dan tidak boleh sampai ke browser.

export interface ForeAkunStatus {
    /** 4 digit terakhir nomor akun — app_settings bisa dibaca publik. */
    hp: string;
    /** Nama yang sedang terpasang di profil akun Fore. */
    nama: string;
    /** false selama akun masih punya order waiting_for_payment/paid/in_process —
     * aturan yang sama dengan applyCustomerName di runCheckoutFore.js. */
    bisaGanti: boolean;
    /** Order yang memblokir ganti nama. */
    kode?: string;
    status?: string;
    /** Diisi kalau worker gagal mengecek akun ini. */
    galat?: string;
}

export interface ForeAkunStatusSnapshot {
    at: string;
    akun: ForeAkunStatus[];
}

export async function fetchForeAkunStatus(): Promise<ForeAkunStatusSnapshot | null> {
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'fore_akun_status')
        .maybeSingle();
    if (error) throw new Error(`Gagal memuat status akun Fore: ${error.message}`);
    if (!data?.value) return null;
    try {
        return JSON.parse(data.value) as ForeAkunStatusSnapshot;
    } catch {
        return null;
    }
}
