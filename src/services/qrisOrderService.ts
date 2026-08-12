import { supabase } from '@/lib/supabase';

export interface QrisOrderItem {
    name: string;
    size?: string;
    quantity: number;
    /** Total baris (unit + addon + tier) x qty — sama seperti angka "Rp ..." di teks WA lama. */
    price: number;
    /** Bagian dari `price` yang TIDAK ikut diskon produk brand (mis. Kopken Syrup/Topping/
     * Espresso Shot) — total baris, sudah x qty. */
    nonDiscountableAmount?: number;
    options: string[];
    notes?: string;
}

export interface QrisOrder {
    id: string;
    order_number: string;
    brand: string;
    customer_name: string;
    outlet: string;
    pickup_time: string | null;
    items: QrisOrderItem[];
    total_amount: number;
    status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'PROCESSED' | 'COMPLETED';
    checkout_job_ids: string[];
    paid_at: string | null;
    created_at: string;
}

/** Pesanan yang sudah dibayar. PROCESSED tetap ditampilkan supaya admin bisa
 * membuka ulang / memproses grup sisanya. */
export async function listNewQrisOrders(limit = 100): Promise<QrisOrder[]> {
    const { data, error } = await supabase
        .from('qris_orders')
        .select('*')
        .in('status', ['PAID', 'PROCESSED'])
        .order('paid_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`Gagal memuat pesanan: ${error.message}`);
    return (data ?? []) as QrisOrder[];
}

export async function getQrisOrder(id: string): Promise<QrisOrder | null> {
    const { data, error } = await supabase
        .from('qris_orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) throw new Error(`Gagal memuat pesanan: ${error.message}`);
    return data as QrisOrder | null;
}

export async function attachCheckoutJob(orderId: string, jobId: string): Promise<void> {
    const { error } = await supabase.rpc('attach_checkout_job', {
        p_order_id: orderId,
        p_job_id: jobId,
    });

    if (error) throw new Error(`Gagal menyambungkan job ke pesanan: ${error.message}`);
}

/** Hapus permanen -- untuk pesanan dibatalkan/refund atau sisa data uji coba. */
export async function deleteQrisOrder(id: string): Promise<void> {
    const { error } = await supabase.from('qris_orders').delete().eq('id', id);
    if (error) throw new Error(`Gagal menghapus pesanan: ${error.message}`);
}

/** Tandai selesai (sudah diambil/dikirim) -- keluar dari daftar "Pesanan Baru"
 * tanpa menghapus datanya, beda dari deleteQrisOrder yang permanen. */
export async function completeQrisOrder(id: string): Promise<void> {
    const { error } = await supabase.from('qris_orders').update({ status: 'COMPLETED' }).eq('id', id);
    if (error) throw new Error(`Gagal menandai pesanan selesai: ${error.message}`);
}
