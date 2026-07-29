// =============================================================================
// DiBeliin Admin - Checkout Job Service
// =============================================================================
// Job queue buat tombol "Proses Checkout" di Calculator (brand kopken only).
// Insert row di sini -> checkout_worker.js (pm2, server dawg.colok.me automation)
// yang polling & jalanin runCheckout(), stream progress ke kolom `log`.

import { supabase } from '@/lib/supabase';

export type CheckoutJobStatus = 'pending' | 'running' | 'success' | 'failed';

export interface CheckoutJobOrderItem {
    name: string;
    options: string[];
    /** Catatan bebas per item (mis. dari baris "Catatan:" WA order) — diteruskan ke orderNotes di runCheckout.js. */
    notes?: string;
}

export interface CheckoutJobOrderPayload {
    outlet: string;
    name: string;
    voucher?: string;
    accountId?: string;
    subtotal: number;
    items: CheckoutJobOrderItem[];
    /** Jadwal pengambilan: "HH:MM" (24 jam, hari ini) buat "Jadwalkan", atau
     * kosongkan buat "Pickup Sekarang". Diteruskan apa adanya ke runCheckout.js. */
    pickupTime?: string;
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

/** Riwayat checkout terbaru (buat halaman CheckoutHistory). */
export async function listCheckoutJobs(limit = 100): Promise<CheckoutJob[]> {
    const { data, error } = await supabase
        .from('checkout_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`Gagal memuat riwayat checkout: ${error.message}`);
    return (data ?? []) as CheckoutJob[];
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
