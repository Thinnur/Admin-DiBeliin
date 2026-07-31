// =============================================================================
// DiBeliin Admin - Dawg (Kopken Panel) Account Service
// =============================================================================
// Read-only access to `dawg_accounts` — the dawg.colok.me checkout-automation
// account pool (synced by Otomasi_web_panel/dibeliin_auto), shown as the
// "KopKen Panel" tab in Inventory.

import { supabase } from '@/lib/supabase';
import type { DawgAccount } from '@/types/database';

export async function fetchDawgAccounts(): Promise<DawgAccount[]> {
    const { data, error } = await supabase
        .from('dawg_accounts')
        .select('*')
        .order('registered_at', { ascending: false });

    if (error) throw new Error(`Gagal memuat KopKen Panel: ${error.message}`);
    return (data ?? []) as DawgAccount[];
}
