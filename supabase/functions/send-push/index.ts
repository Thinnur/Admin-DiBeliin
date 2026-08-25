// =============================================================================
// send-push — pengirim Web Push
// =============================================================================
// Dipanggil trigger DB (public.notify_push) tiap ada pesanan baru / job checkout
// berubah. Body: { title, body, url, tag }. Auth-nya header x-webhook-secret
// yang dicocokkan ke public.push_config, bukan JWT — pemanggilnya Postgres,
// bukan browser.
//
// Kunci VAPID sengaja disimpan di tabel push_config (RLS nyala, tanpa policy =
// service_role only) bukan di secret Edge Function, supaya rotasi kunci cukup
// satu UPDATE dan tidak perlu redeploy/atur env di dua tempat.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface PushRow {
    endpoint: string;
    p256dh: string;
    auth: string;
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

Deno.serve(async (req) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: cfg, error: cfgError } = await supabase
        .from('push_config')
        .select('vapid_public, vapid_private, vapid_subject, webhook_secret')
        .limit(1)
        .maybeSingle();

    if (cfgError || !cfg) return json({ error: 'push_config tidak terbaca' }, 500);
    if (req.headers.get('x-webhook-secret') !== cfg.webhook_secret) {
        return json({ error: 'forbidden' }, 403);
    }

    const { title, body, url, tag } = await req.json().catch(() => ({}));
    if (!title) return json({ error: 'title wajib diisi' }, 400);

    const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth');

    webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);

    const payload = JSON.stringify({ title, body: body ?? '', url: url ?? '/', tag });
    const expired: string[] = [];
    let sent = 0;

    await Promise.all(((subs ?? []) as PushRow[]).map(async (sub) => {
        try {
            await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload
            );
            sent++;
        } catch (error) {
            // 404/410 = device sudah tidak berlangganan (app di-uninstall, izin dicabut,
            // subscription dirotasi browser). Buang biar tabelnya tidak jadi kuburan.
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) expired.push(sub.endpoint);
            else console.error('push gagal', sub.endpoint, status, String(error));
        }
    }));

    if (expired.length) {
        await supabase.from('push_subscriptions').delete().in('endpoint', expired);
    }

    return json({ sent, pruned: expired.length });
});
