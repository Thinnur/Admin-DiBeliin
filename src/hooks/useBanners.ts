// =============================================================================
// DiBeliin Admin - useBanners Hook
// =============================================================================
// Encapsulates state management, image compression (WebP < 100KB), and
// all CRUD operations for banner management.

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
    getBanners,
    createBanner,
    updateBanner,
    deleteBanner,
    uploadBannerImage,
    type Banner,
} from '@/services/bannerService';

// -----------------------------------------------------------------------------
// Image Compression Utility
// -----------------------------------------------------------------------------

const MAX_SIZE_BYTES = 100 * 1024; // 100 KB
const MAX_DIMENSION = 1920;        // Max width or height in pixels

/**
 * Compress an image File into a WebP Blob under 100 KB.
 * Uses an HTML Canvas to draw the image and re-export it at decreasing quality.
 */
export async function compressToWebP(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            // Scale down to MAX_DIMENSION while preserving aspect ratio
            let { width, height } = img;
            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                if (width >= height) {
                    height = Math.round((height / width) * MAX_DIMENSION);
                    width = MAX_DIMENSION;
                } else {
                    width = Math.round((width / height) * MAX_DIMENSION);
                    height = MAX_DIMENSION;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);

            // Try quality levels from 0.85 down to 0.10 to achieve < 100 KB
            const qualities = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15, 0.10];
            let index = 0;

            const tryQuality = () => {
                const q = index < qualities.length ? qualities[index] : 0.05;
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to convert image to WebP'));
                            return;
                        }
                        if (blob.size <= MAX_SIZE_BYTES || index >= qualities.length) {
                            resolve(blob);
                        } else {
                            index++;
                            tryQuality();
                        }
                    },
                    'image/webp',
                    q
                );
            };

            tryQuality();
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image'));
        };

        img.src = objectUrl;
    });
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export interface UseBannersReturn {
    banners: Banner[];
    isLoading: boolean;
    isUploading: boolean;
    savingId: string | null;
    deletingId: string | null;
    fetchBanners: () => Promise<void>;
    handleUpload: (
        file: File,
        targetUrl: string | null,
        sequence: number
    ) => Promise<void>;
    handleUpdateSequence: (id: string, sequence: number) => Promise<void>;
    handleToggleActive: (id: string, currentValue: boolean) => Promise<void>;
    handleDelete: (id: string, imageUrl: string) => Promise<void>;
}

export function useBanners(): UseBannersReturn {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // -------------------------------------------------------------------------
    // Fetch
    // -------------------------------------------------------------------------

    const fetchBanners = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getBanners();
            setBanners(data);
        } catch (err) {
            console.error(err);
            toast.error('Gagal memuat data banner');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBanners();
    }, [fetchBanners]);

    // -------------------------------------------------------------------------
    // Upload + Create
    // -------------------------------------------------------------------------

    const handleUpload = useCallback(
        async (file: File, targetUrl: string | null, sequence: number) => {
            setIsUploading(true);
            try {
                // Step 1: Compress to WebP < 100 KB
                const webpBlob = await compressToWebP(file);

                // Step 2: Upload to Supabase Storage with unique filename
                const fileName = `${Date.now()}-banner.webp`;
                const publicUrl = await uploadBannerImage(webpBlob, fileName);

                // Step 3: Insert row into `banners` table
                const newBanner = await createBanner({
                    image_url: publicUrl,
                    target_url: targetUrl || null,
                    sequence,
                    is_active: true,
                });

                setBanners((prev) =>
                    [...prev, newBanner].sort((a, b) => a.sequence - b.sequence)
                );
                toast.success('Banner berhasil ditambahkan!');
            } catch (err) {
                console.error(err);
                const msg = err instanceof Error ? err.message : 'Gagal mengupload banner';
                toast.error(msg);
            } finally {
                setIsUploading(false);
            }
        },
        []
    );

    // -------------------------------------------------------------------------
    // Update Sequence
    // -------------------------------------------------------------------------

    const handleUpdateSequence = useCallback(
        async (id: string, sequence: number) => {
            setSavingId(id);
            try {
                const updated = await updateBanner(id, { sequence });
                setBanners((prev) =>
                    prev
                        .map((b) => (b.id === id ? updated : b))
                        .sort((a, b) => a.sequence - b.sequence)
                );
                toast.success('Urutan banner diperbarui');
            } catch (err) {
                console.error(err);
                toast.error('Gagal memperbarui urutan banner');
            } finally {
                setSavingId(null);
            }
        },
        []
    );

    // -------------------------------------------------------------------------
    // Toggle is_active
    // -------------------------------------------------------------------------

    const handleToggleActive = useCallback(
        async (id: string, currentValue: boolean) => {
            setSavingId(id);
            // Optimistic update
            setBanners((prev) =>
                prev.map((b) => (b.id === id ? { ...b, is_active: !currentValue } : b))
            );
            try {
                await updateBanner(id, { is_active: !currentValue });
                toast.success(`Banner ${!currentValue ? 'diaktifkan' : 'dinonaktifkan'}`);
            } catch (err) {
                // Rollback on failure
                setBanners((prev) =>
                    prev.map((b) => (b.id === id ? { ...b, is_active: currentValue } : b))
                );
                console.error(err);
                toast.error('Gagal mengubah status banner');
            } finally {
                setSavingId(null);
            }
        },
        []
    );

    // -------------------------------------------------------------------------
    // Delete (DB + Storage)
    // -------------------------------------------------------------------------

    const handleDelete = useCallback(async (id: string, imageUrl: string) => {
        setDeletingId(id);
        try {
            await deleteBanner(id, imageUrl);
            setBanners((prev) => prev.filter((b) => b.id !== id));
            toast.success('Banner berhasil dihapus');
        } catch (err) {
            console.error(err);
            const msg = err instanceof Error ? err.message : 'Gagal menghapus banner';
            toast.error(msg);
        } finally {
            setDeletingId(null);
        }
    }, []);

    return {
        banners,
        isLoading,
        isUploading,
        savingId,
        deletingId,
        fetchBanners,
        handleUpload,
        handleUpdateSequence,
        handleToggleActive,
        handleDelete,
    };
}
