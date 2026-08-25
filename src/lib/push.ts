// =============================================================================
// DiBeliin Admin - Web Push
// =============================================================================
// Daftarin device ke tabel push_subscriptions; pengirimannya di Edge Function
// send-push yang dipanggil trigger DB (lihat migrasi web_push_notifications).
//
// Catatan iOS: Web Push cuma jalan kalau webnya di-Add to Home Screen dulu
// (iOS 16.4+). Di tab Safari biasa `PushManager` memang tidak ada.

import { supabase } from '@/lib/supabase';

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

const SW_URL = '/sw.js';

export function pushSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** iOS yang belum di-install ke Home Screen — satu-satunya penyebab "unsupported" yang bisa dibenerin user. */
export function needsIosInstall(): boolean {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const installed = window.matchMedia('(display-mode: standalone)').matches
        || (navigator as { standalone?: boolean }).standalone === true;
    return isIos && !installed;
}

function urlBase64ToUint8Array(base64: string) {
    const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const raw = atob(padded);
    // ArrayBuffer dibuat eksplisit: applicationServerKey tidak menerima
    // Uint8Array yang buffer-nya bisa SharedArrayBuffer.
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
}

async function getSubscription(): Promise<PushSubscription | null> {
    const registration = await navigator.serviceWorker.getRegistration(SW_URL);
    return (await registration?.pushManager.getSubscription()) ?? null;
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
    const { keys } = subscription.toJSON() as { keys?: { p256dh: string; auth: string } };
    if (!keys) throw new Error('Subscription tidak punya kunci enkripsi.');

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('push_subscriptions').upsert({
        endpoint: subscription.endpoint,
        user_id: user?.id ?? null,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });

    if (error) throw new Error(`Gagal menyimpan langganan notifikasi: ${error.message}`);
}

export async function getPushState(): Promise<PushState> {
    if (!pushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    return (await getSubscription()) ? 'on' : 'off';
}

/**
 * Daftarin ulang baris DB-nya kalau device ini memang sudah subscribe. Perlu
 * karena send-push menghapus endpoint yang balas 404/410, dan browser sesekali
 * merotasi endpoint sendiri — tanpa ini device-nya diam-diam berhenti dapat notif.
 */
export async function resyncPush(): Promise<void> {
    if (!pushSupported() || Notification.permission !== 'granted') return;
    const subscription = await getSubscription();
    if (subscription) await saveSubscription(subscription);
}

export async function enablePush(): Promise<PushState> {
    if (!pushSupported()) return 'unsupported';

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

    const registration = await navigator.serviceWorker.register(SW_URL);
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        const { data: vapidPublicKey, error } = await supabase.rpc('get_vapid_public_key');
        if (error || !vapidPublicKey) throw new Error('Kunci VAPID tidak terbaca dari server.');

        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey as string),
        });
    }

    await saveSubscription(subscription);
    // Notif percobaan langsung: biar ketahuan detik itu juga kalau device/browser
    // ini ternyata memblokir, bukan baru ketahuan pas ada pesanan masuk beneran.
    await supabase.rpc('send_test_push');
    return 'on';
}

export async function disablePush(): Promise<PushState> {
    const subscription = await getSubscription();
    if (subscription) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        await subscription.unsubscribe();
    }
    return 'off';
}
