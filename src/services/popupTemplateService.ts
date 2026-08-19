// =============================================================================
// DiBeliin Admin - Popup Template Service
// =============================================================================
// CRUD for "brand closed" popup templates + per-brand active template selection

import { supabase } from '@/lib/supabase';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PopupTemplate {
    id: string;
    name: string;
    emoji: string;
    title: string;
    message: string;
    button_text: string;
    created_at: string;
}

export type PopupTemplateInsert = Omit<PopupTemplate, 'id' | 'created_at'>;
export type PopupTemplateUpdate = Partial<PopupTemplateInsert>;

export type PopupBrand = 'fore' | 'kenangan' | 'tomoro' | 'janjijiwa' | 'chatime';

const ACTIVE_TEMPLATE_KEYS: Record<PopupBrand, string> = {
    fore: 'popup_template_fore',
    kenangan: 'popup_template_kenangan',
    tomoro: 'popup_template_tomoro',
    janjijiwa: 'popup_template_janjijiwa',
    chatime: 'popup_template_chatime',
};

// -----------------------------------------------------------------------------
// Template CRUD
// -----------------------------------------------------------------------------

export async function getPopupTemplates(): Promise<PopupTemplate[]> {
    const { data, error } = await supabase
        .from('popup_templates')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching popup templates:', error);
        throw new Error(`Gagal memuat templat popup: ${error.message}`);
    }

    return data || [];
}

export async function createPopupTemplate(data: PopupTemplateInsert): Promise<PopupTemplate> {
    const { data: inserted, error } = await supabase
        .from('popup_templates')
        .insert(data)
        .select()
        .single();

    if (error) {
        console.error('Error creating popup template:', error);
        throw new Error(`Gagal menyimpan templat: ${error.message}`);
    }

    return inserted as PopupTemplate;
}

export async function updatePopupTemplate(id: string, data: PopupTemplateUpdate): Promise<PopupTemplate> {
    const { data: updated, error } = await supabase
        .from('popup_templates')
        .update(data)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating popup template:', error);
        throw new Error(`Gagal memperbarui templat: ${error.message}`);
    }

    return updated as PopupTemplate;
}

export async function deletePopupTemplate(id: string): Promise<void> {
    const { error } = await supabase.from('popup_templates').delete().eq('id', id);

    if (error) {
        console.error('Error deleting popup template:', error);
        throw new Error(`Gagal menghapus templat: ${error.message}`);
    }
}

// -----------------------------------------------------------------------------
// Active Template Per Brand
// -----------------------------------------------------------------------------

/** Fetch the active template id for each brand, e.g. { fore: 'uuid', kenangan: null, ... } */
export async function getActiveTemplateIds(): Promise<Record<PopupBrand, string | null>> {
    const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', Object.values(ACTIVE_TEMPLATE_KEYS));

    if (error) {
        console.error('Error fetching active popup templates:', error);
        throw new Error(`Gagal memuat templat aktif: ${error.message}`);
    }

    const byKey = new Map((data || []).map((row) => [row.key, row.value as string]));
    return {
        fore: byKey.get(ACTIVE_TEMPLATE_KEYS.fore) ?? null,
        kenangan: byKey.get(ACTIVE_TEMPLATE_KEYS.kenangan) ?? null,
        tomoro: byKey.get(ACTIVE_TEMPLATE_KEYS.tomoro) ?? null,
        janjijiwa: byKey.get(ACTIVE_TEMPLATE_KEYS.janjijiwa) ?? null,
        chatime: byKey.get(ACTIVE_TEMPLATE_KEYS.chatime) ?? null,
    };
}

/** Set which template is active for a given brand */
export async function setActiveTemplate(brand: PopupBrand, templateId: string): Promise<void> {
    const { error } = await supabase
        .from('app_settings')
        .upsert(
            { key: ACTIVE_TEMPLATE_KEYS[brand], value: templateId },
            { onConflict: 'key' }
        );

    if (error) {
        console.error(`Error setting active popup template for ${brand}:`, error);
        throw new Error(`Gagal mengatur templat aktif: ${error.message}`);
    }
}
