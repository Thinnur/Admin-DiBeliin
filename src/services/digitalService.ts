// =============================================================================
// DiBeliin Admin - Digital Service
// =============================================================================
// CRUD operations for digital products, subscriptions, and providers

import { supabase } from '@/lib/supabase';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Row in the `digital_providers` table */
export interface DigitalProvider {
    id: number;
    name: string;
    logo_url: string | null;
    created_at: string;
}

export interface DigitalProduct {
    id: number;
    name: string;
    provider: string;
    price: number;
    duration: string;
    description: string | null;
    is_available: boolean;
    created_at: string;
}

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export interface DigitalSubscription {
    id: number;
    customer_name: string;
    customer_wa: string;
    product_name: string;
    account_email: string;
    account_password: string;
    profile_name: string | null;
    start_date: string;
    end_date: string;
    status: SubscriptionStatus;
    created_at: string;
}

// -----------------------------------------------------------------------------
// Digital Provider CRUD
// -----------------------------------------------------------------------------

export async function getProviders(): Promise<DigitalProvider[]> {
    const { data, error } = await supabase
        .from('digital_providers')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching providers:', error);
        throw new Error(`Gagal mengambil data provider: ${error.message}`);
    }

    return data || [];
}

export async function createProvider(
    provider: Omit<DigitalProvider, 'id' | 'created_at'>
): Promise<DigitalProvider> {
    const { data, error } = await supabase
        .from('digital_providers')
        .insert(provider)
        .select()
        .single();

    if (error) {
        console.error('Error creating provider:', error);
        throw new Error(`Gagal membuat provider: ${error.message}`);
    }

    return data;
}

export async function updateProvider(
    id: number,
    provider: Partial<Omit<DigitalProvider, 'id' | 'created_at'>>
): Promise<DigitalProvider> {
    const { data, error } = await supabase
        .from('digital_providers')
        .update(provider)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating provider:', error);
        throw new Error(`Gagal memperbarui provider: ${error.message}`);
    }

    return data;
}

export async function deleteProvider(id: number): Promise<void> {
    const { error } = await supabase
        .from('digital_providers')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting provider:', error);
        throw new Error(`Gagal menghapus provider: ${error.message}`);
    }
}

// -----------------------------------------------------------------------------
// Digital Product CRUD
// -----------------------------------------------------------------------------

export async function getDigitalProducts(): Promise<DigitalProduct[]> {
    const { data, error } = await supabase
        .from('digital_products')
        .select('*')
        .order('provider', { ascending: true })
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching digital products:', error);
        throw new Error(`Gagal mengambil data produk digital: ${error.message}`);
    }

    return data || [];
}

export async function createDigitalProduct(
    product: Omit<DigitalProduct, 'id' | 'created_at'>
): Promise<DigitalProduct> {
    const { data, error } = await supabase
        .from('digital_products')
        .insert(product)
        .select()
        .single();

    if (error) {
        console.error('Error creating digital product:', error);
        throw new Error(`Gagal membuat produk digital: ${error.message}`);
    }

    return data;
}

export async function updateDigitalProduct(
    id: number,
    product: Partial<Omit<DigitalProduct, 'id' | 'created_at'>>
): Promise<DigitalProduct> {
    const { data, error } = await supabase
        .from('digital_products')
        .update(product)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating digital product:', error);
        throw new Error(`Gagal memperbarui produk digital: ${error.message}`);
    }

    return data;
}

export async function deleteDigitalProduct(id: number): Promise<void> {
    const { error } = await supabase
        .from('digital_products')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting digital product:', error);
        throw new Error(`Gagal menghapus produk digital: ${error.message}`);
    }
}

// -----------------------------------------------------------------------------
// Digital Subscription CRUD
// -----------------------------------------------------------------------------

export async function getDigitalSubscriptions(): Promise<DigitalSubscription[]> {
    const { data, error } = await supabase
        .from('digital_subscriptions')
        .select('*')
        .order('end_date', { ascending: true });

    if (error) {
        console.error('Error fetching digital subscriptions:', error);
        throw new Error(`Gagal mengambil data langganan: ${error.message}`);
    }

    return data || [];
}

export async function createDigitalSubscription(
    subscription: Omit<DigitalSubscription, 'id' | 'created_at'>
): Promise<DigitalSubscription> {
    const { data, error } = await supabase
        .from('digital_subscriptions')
        .insert(subscription)
        .select()
        .single();

    if (error) {
        console.error('Error creating digital subscription:', error);
        throw new Error(`Gagal mencatat langganan: ${error.message}`);
    }

    return data;
}

export async function updateDigitalSubscription(
    id: number,
    subscription: Partial<Omit<DigitalSubscription, 'id' | 'created_at'>>
): Promise<DigitalSubscription> {
    const { data, error } = await supabase
        .from('digital_subscriptions')
        .update(subscription)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating digital subscription:', error);
        throw new Error(`Gagal memperbarui langganan: ${error.message}`);
    }

    return data;
}

export async function deleteDigitalSubscription(id: number): Promise<void> {
    const { error } = await supabase
        .from('digital_subscriptions')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting digital subscription:', error);
        throw new Error(`Gagal menghapus langganan: ${error.message}`);
    }
}
