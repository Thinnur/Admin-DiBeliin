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
    category: string;
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
 * @param data - Fields to update (prices, availability)
 */
export async function updateMenuItem(id: number, data: MenuItemUpdate): Promise<MenuItem> {
    const { data: updated, error } = await supabase
        .from('menu_items')
        .update(data)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating menu item:', error);
        throw new Error(`Failed to update menu item: ${error.message}`);
    }

    return updated;
}
