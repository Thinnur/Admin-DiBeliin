// =============================================================================
// DiBeliin Admin - Menu Service
// =============================================================================
// CRUD operations for menu items (prices, availability)

import { supabase } from '@/lib/supabase';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface MenuItem {
    id: number;
    brand: 'fore' | 'kenangan';
    categories: string[];
    name: string;
    description: string | null;
    image_url: string | null;
    regular_price: number | null;
    large_price: number | null;
    regular_discount_price: number | null;
    large_discount_price: number | null;
    badge: string | null;
    is_available: boolean;
    created_at: string;
}

export interface MenuItemUpdate {
    name?: string;
    brand?: 'fore' | 'kenangan';
    categories?: string[];
    regular_price?: number | null;
    large_price?: number | null;
    regular_discount_price?: number | null;
    large_discount_price?: number | null;
    is_available?: boolean;
}

// -----------------------------------------------------------------------------
// Menu Item Operations
// -----------------------------------------------------------------------------

/**
 * Fetch all menu items, ordered by brand then name
 */
export async function getMenuItems(): Promise<MenuItem[]> {
    const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('brand', { ascending: true })
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching menu items:', error);
        throw new Error(`Failed to fetch menu items: ${error.message}`);
    }

    return data || [];
}

/**
 * Create a new menu item
 * @param item - New menu item data (without id and created_at)
 */
export async function createMenuItem(item: Omit<MenuItem, 'id' | 'created_at'>): Promise<MenuItem> {
    const { data: newItem, error } = await supabase
        .from('menu_items')
        .insert(item)
        .select()
        .single();

    if (error) {
        console.error('Error creating menu item:', error);
        throw new Error(`Failed to create menu item: ${error.message}`);
    }

    return newItem;
}

/**
 * Update a menu item by ID
 * @param id - Menu item ID
 * @param data - Fields to update (name, brand, categories, prices, availability)
 */
export async function updateMenuItem(id: number, data: MenuItemUpdate): Promise<MenuItem> {
    // Ensure ID is a number
    const numericId = Number(id);
    if (isNaN(numericId)) {
        throw new Error(`Invalid menu item ID: ${id}`);
    }

    // Build a clean payload - only include defined fields
    const cleanPayload: Record<string, unknown> = {};

    if (data.name !== undefined) {
        cleanPayload.name = data.name;
    }
    if (data.brand !== undefined) {
        cleanPayload.brand = data.brand;
    }
    if (data.categories !== undefined) {
        cleanPayload.categories = data.categories;
    }
    if (data.regular_price !== undefined) {
        cleanPayload.regular_price = data.regular_price;
    }
    if (data.large_price !== undefined) {
        cleanPayload.large_price = data.large_price;
    }
    if (data.regular_discount_price !== undefined) {
        cleanPayload.regular_discount_price = data.regular_discount_price;
    }
    if (data.large_discount_price !== undefined) {
        cleanPayload.large_discount_price = data.large_discount_price;
    }
    if (data.is_available !== undefined) {
        cleanPayload.is_available = data.is_available;
    }

    console.log('menuService.updateMenuItem - ID:', numericId, 'Type:', typeof numericId);
    console.log('Clean payload:', cleanPayload);

    // First, check if the item exists (helps debug RLS issues)
    const { data: existingItem, error: fetchError } = await supabase
        .from('menu_items')
        .select('id, name')
        .eq('id', numericId)
        .single();

    console.log('Pre-check - Existing item:', existingItem, 'Fetch error:', fetchError);

    if (fetchError || !existingItem) {
        console.error('Item not found or RLS blocking read. Error:', fetchError);
        throw new Error(`Menu item with ID ${numericId} not found (RLS may be blocking access)`);
    }

    // Now perform the update
    const { data: updatedRows, error: updateError } = await supabase
        .from('menu_items')
        .update(cleanPayload)
        .eq('id', numericId)
        .select();

    console.log('Update result - Rows:', updatedRows, 'Error:', updateError);

    if (updateError) {
        console.error('Supabase error updating menu item:', updateError);
        throw new Error(`Failed to update menu item: ${updateError.message}`);
    }

    // Handle case where no rows were updated
    if (!updatedRows || updatedRows.length === 0) {
        throw new Error(`Update returned no rows - RLS may be blocking UPDATE operations on ID ${numericId}`);
    }

    return updatedRows[0] as MenuItem;
}
