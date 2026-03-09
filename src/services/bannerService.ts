// =============================================================================
// DiBeliin Admin - Banner Service
// =============================================================================
// CRUD operations for homepage banners + Supabase Storage management

import { supabase } from '@/lib/supabase';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface Banner {
    id: string;           // UUID
    image_url: string;
    target_url: string | null;
    sequence: number;
    is_active: boolean;
    created_at: string;
}

export type BannerInsert = Omit<Banner, 'id' | 'created_at'>;
export type BannerUpdate = Partial<Pick<Banner, 'sequence' | 'is_active' | 'target_url'>>;

// -----------------------------------------------------------------------------
// Storage Path Helper
// -----------------------------------------------------------------------------

/**
 * Derive the storage filename from a Supabase public URL.
 * e.g. "https://xxx.supabase.co/storage/v1/object/public/banners/1741234567890-banner.webp"
 *   → "1741234567890-banner.webp"
 */
export function extractStoragePath(imageUrl: string): string {
    const marker = '/banners/';
    const idx = imageUrl.indexOf(marker);
    if (idx === -1) return '';
    // Strip any query params (cache-busting, etc.)
    return imageUrl.substring(idx + marker.length).split('?')[0];
}

// -----------------------------------------------------------------------------
// Read
// -----------------------------------------------------------------------------

/**
 * Fetch all banners ordered by sequence ascending
 */
export async function getBanners(): Promise<Banner[]> {
    const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('sequence', { ascending: true });

    if (error) {
        console.error('Error fetching banners:', error);
        throw new Error(`Gagal memuat data banner: ${error.message}`);
    }

    return data || [];
}

// -----------------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------------

/**
 * Insert a new banner row after uploading the image to Storage
 */
export async function createBanner(data: BannerInsert): Promise<Banner> {
    const { data: inserted, error } = await supabase
        .from('banners')
        .insert(data)
        .select()
        .single();

    if (error) {
        console.error('Error creating banner:', error);
        throw new Error(`Gagal menyimpan banner: ${error.message}`);
    }

    return inserted as Banner;
}

// -----------------------------------------------------------------------------
// Update
// -----------------------------------------------------------------------------

/**
 * Partially update a banner (sequence, is_active, target_url)
 */
export async function updateBanner(id: string, data: BannerUpdate): Promise<Banner> {
    const { data: updated, error } = await supabase
        .from('banners')
        .update(data)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating banner:', error);
        throw new Error(`Gagal memperbarui banner: ${error.message}`);
    }

    return updated as Banner;
}

// -----------------------------------------------------------------------------
// Delete (Garbage Collection)
// -----------------------------------------------------------------------------

/**
 * Delete a banner row AND its image file from Supabase Storage.
 *
 * @param id       - Database row UUID
 * @param imageUrl - Public URL of the image (used to derive storage path)
 */
export async function deleteBanner(id: string, imageUrl: string): Promise<void> {
    // 1. Delete the DB row first
    const { error: dbError } = await supabase
        .from('banners')
        .delete()
        .eq('id', id);

    if (dbError) {
        console.error('Error deleting banner row:', dbError);
        throw new Error(`Gagal menghapus banner dari database: ${dbError.message}`);
    }

    // 2. Delete the file from Storage (best-effort)
    const storagePath = extractStoragePath(imageUrl);
    if (storagePath) {
        const { error: storageError } = await supabase.storage
            .from('banners')
            .remove([storagePath]);

        if (storageError) {
            console.error('Error deleting banner from storage (non-fatal):', storageError);
        }
    }
}

// -----------------------------------------------------------------------------
// Storage Upload Helper
// -----------------------------------------------------------------------------

/**
 * Upload a WebP Blob to the 'banners' bucket.
 * Returns the public URL of the uploaded image.
 *
 * @param blob     - Compressed WebP Blob
 * @param fileName - Unique filename (e.g. "1741234567890-banner.webp")
 */
export async function uploadBannerImage(
    blob: Blob,
    fileName: string
): Promise<string> {
    const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(fileName, blob, {
            contentType: 'image/webp',
            cacheControl: '31536000', // Cache for 1 year in browser
            upsert: false,
        });

    if (uploadError) {
        console.error('Error uploading banner image:', uploadError);
        throw new Error(`Gagal mengupload gambar: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
        .from('banners')
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}
