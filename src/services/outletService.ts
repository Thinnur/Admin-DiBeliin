// =============================================================================
// DiBeliin Admin - Outlet Service
// =============================================================================
// Handles outlet management CRUD operations

import { supabase } from '@/lib/supabase';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface Outlet {
    id: number;
    name: string;
    brand: 'fore' | 'kenangan';
    city: string;
    is_premium: boolean;
    is_active: boolean;
}

export type OutletInsert = Omit<Outlet, 'id'>;
export type OutletUpdate = Partial<OutletInsert>;

// -----------------------------------------------------------------------------
// Read Operations
// -----------------------------------------------------------------------------

/**
 * Fetch all outlets, ordered by name
 */
export async function getOutlets(): Promise<Outlet[]> {
    const { data, error } = await supabase
        .from('outlets')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching outlets:', error);
        throw new Error(`Failed to fetch outlets: ${error.message}`);
    }

    return data || [];
}

// -----------------------------------------------------------------------------
// Write Operations
// -----------------------------------------------------------------------------

/**
 * Create a new outlet
 * @param outlet - Outlet data (without ID)
 */
export async function createOutlet(outlet: OutletInsert): Promise<Outlet> {
    const { data, error } = await supabase
        .from('outlets')
        .insert({
            name: outlet.name,
            brand: outlet.brand,
            city: outlet.city || 'Jakarta',
            is_premium: outlet.is_premium ?? false,
            is_active: outlet.is_active ?? true,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating outlet:', error);
        throw new Error(`Failed to create outlet: ${error.message}`);
    }

    return data;
}

/**
 * Update an existing outlet
 * @param id - Outlet ID
 * @param updates - Partial outlet data to update
 */
export async function updateOutlet(id: number, updates: OutletUpdate): Promise<Outlet> {
    const { data, error } = await supabase
        .from('outlets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating outlet:', error);
        throw new Error(`Failed to update outlet: ${error.message}`);
    }

    return data;
}

/**
 * Delete an outlet by ID
 * @param id - Outlet ID to delete
 */
export async function deleteOutlet(id: number): Promise<void> {
    const { error } = await supabase.from('outlets').delete().eq('id', id);

    if (error) {
        console.error('Error deleting outlet:', error);
        throw new Error(`Failed to delete outlet: ${error.message}`);
    }
}
