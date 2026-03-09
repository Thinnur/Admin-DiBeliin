// =============================================================================
// DiBeliin Admin - Food Menu Service
// =============================================================================
// CRUD operations for food menu items (fast food / makanan cepat saji)
// Uses the `food_menus` table in Supabase

import { supabase } from '@/lib/supabase';
import type { FoodMenu, FoodMenuInsert, FoodMenuUpdate } from '@/types/database';

// -----------------------------------------------------------------------------
// Food Menu Operations
// -----------------------------------------------------------------------------

/**
 * Fetch all food menu items, ordered by name
 */
export async function getFoodMenus(): Promise<FoodMenu[]> {
    const { data, error } = await supabase
        .from('food_menus')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching food menus:', error);
        throw new Error(`Gagal memuat data makanan: ${error.message}`);
    }

    return data || [];
}

/**
 * Create a new food menu item
 * @param item - New food menu data (without id and created_at)
 */
export async function createFoodMenu(item: FoodMenuInsert): Promise<FoodMenu> {
    const { data: newItem, error } = await supabase
        .from('food_menus')
        .insert(item)
        .select()
        .single();

    if (error) {
        console.error('Error creating food menu:', error);
        throw new Error(`Gagal menambahkan makanan: ${error.message}`);
    }

    return newItem as FoodMenu;
}

/**
 * Update a food menu item by ID
 * @param id - Food menu item UUID
 * @param data - Fields to update
 */
export async function updateFoodMenu(id: string, data: FoodMenuUpdate): Promise<FoodMenu> {
    const { data: updatedItem, error } = await supabase
        .from('food_menus')
        .update(data)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating food menu:', error);
        throw new Error(`Gagal memperbarui makanan: ${error.message}`);
    }

    if (!updatedItem) {
        throw new Error(`Item dengan ID ${id} tidak ditemukan`);
    }

    return updatedItem as FoodMenu;
}

/**
 * Delete a food menu item by ID
 * @param id - Food menu item UUID
 */
export async function deleteFoodMenu(id: string): Promise<void> {
    const { error } = await supabase
        .from('food_menus')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting food menu:', error);
        throw new Error(`Gagal menghapus makanan: ${error.message}`);
    }
}
