-- =============================================================================
-- Web Push: notifikasi pesanan baru & perkembangan job checkout
-- =============================================================================
-- Sudah diterapkan ke project znmkjlxvwswqobfleupu (2026-08-25) lewat Supabase MCP.
-- Alur: INSERT/UPDATE baris -> trigger -> public.notify_push -> pg_net ->
-- Edge Function `send-push` -> Web Push ke semua device di push_subscriptions.
--
-- CATATAN: baris INSERT push_config di bawah sengaja pakai placeholder. Kunci
-- VAPID asli TIDAK ditaruh di repo — yang di produksi diisi langsung ke tabelnya.
-- Bikin pasangan kunci baru: npx web-push generate-vapid-keys --json

create table if not exists public.push_subscriptions (
    endpoint      text primary key,
    user_id       uuid references auth.users(id) on delete cascade,
    p256dh        text not null,
    auth          text not null,
    user_agent    text,
    created_at    timestamptz not null default now(),
    last_seen_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- Kunci VAPID + secret webhook. RLS nyala tanpa policy = cuma service_role yang bisa baca.
create table if not exists public.push_config (
    id             boolean primary key default true check (id),
    vapid_public   text not null,
    vapid_private  text not null,
    vapid_subject  text not null default 'https://dibeliin.akzara.id',
    webhook_secret text not null default gen_random_uuid()::text,
    fn_url         text not null
);

alter table public.push_config enable row level security;

insert into public.push_config (vapid_public, vapid_private, fn_url)
values (
    'ISI_VAPID_PUBLIC_KEY',
    'ISI_VAPID_PRIVATE_KEY',
    'https://znmkjlxvwswqobfleupu.supabase.co/functions/v1/send-push'
)
on conflict (id) do nothing;

-- Frontend butuh public key-nya buat subscribe; private key tetap tidak terekspos.
create or replace function public.get_vapid_public_key()
returns text
language sql
stable
security definer
set search_path = public
as $$ select vapid_public from public.push_config limit 1 $$;

grant execute on function public.get_vapid_public_key() to anon, authenticated;

-- Pengirim: satu pintu ke Edge Function send-push.
create or replace function public.notify_push(p_title text, p_body text, p_url text, p_tag text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    cfg public.push_config%rowtype;
begin
    select * into cfg from public.push_config limit 1;
    if not found then return; end if;

    perform net.http_post(
        url := cfg.fn_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', cfg.webhook_secret
        ),
        body := jsonb_build_object('title', p_title, 'body', p_body, 'url', p_url, 'tag', p_tag),
        timeout_milliseconds := 5000
    );
end $$;

-- Notif percobaan dari tombol "Aktifkan Notifikasi". Lewat RPC, bukan langsung
-- ke Edge Function, supaya webhook_secret tidak perlu ada di browser.
create or replace function public.send_test_push()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.notify_push(
        'Notifikasi aktif',
        'Device ini bakal dapat kabar pesanan baru & status checkout.',
        '/calculator',
        'push-test'
    );
end $$;

revoke all on function public.send_test_push() from public, anon;
grant execute on function public.send_test_push() to authenticated;

-- Pesanan baru yang sudah dibayar.
create or replace function public.qris_orders_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.status = 'PAID' and (tg_op = 'INSERT' or old.status is distinct from 'PAID') then
        perform public.notify_push(
            'Pesanan baru — ' || initcap(coalesce(new.brand, '?')),
            coalesce(new.customer_name, '-') || ' · ' || coalesce(new.outlet, '-')
                || ' · Rp ' || replace(to_char(coalesce(new.total_amount, 0), 'FM999,999,999'), ',', '.'),
            '/calculator/' || new.id,
            'order-' || new.id
        );
    end if;
    return null;
end $$;

drop trigger if exists trg_qris_orders_push on public.qris_orders;
create trigger trg_qris_orders_push
    after insert or update on public.qris_orders
    for each row execute function public.qris_orders_push();

-- Perkembangan job checkout: gagal / siap diambil / nomor antrean keluar / sukses.
-- Satu update = maksimal satu notif (urutan if-elsif), biar HP tidak bergetar dobel.
create or replace function public.checkout_jobs_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    payload   jsonb := coalesce(new.order_payload, '{}'::jsonb);
    old_res   jsonb := coalesce(old.result, '{}'::jsonb);
    new_res   jsonb := coalesce(new.result, '{}'::jsonb);
    label     text  := coalesce(payload->>'name', '-') || ' · ' || coalesce(payload->>'outlet', '-');
    job_url   text  := '/checkout-process/' || new.id;
    job_tag   text  := 'job-' || new.id;
    new_queue text  := new_res->>'queueNumber';
begin
    if new.status = 'failed' and old.status is distinct from 'failed' then
        perform public.notify_push('Checkout gagal', label, job_url, job_tag);

    elsif new_res->>'phase' = 'Ambil Sekarang' and (old_res->>'phase') is distinct from 'Ambil Sekarang' then
        perform public.notify_push('Siap diambil', label, job_url, job_tag);

    elsif new_queue is not null and (old_res->>'queueNumber') is null then
        perform public.notify_push('Nomor antrean ' || new_queue, label, job_url, job_tag);

    elsif new.status = 'success' and old.status is distinct from 'success' then
        perform public.notify_push('Checkout sukses', label, job_url, job_tag);
    end if;
    return null;
end $$;

-- WHEN: update yang cuma nambah baris log (kolom `log`) di-skip total.
drop trigger if exists trg_checkout_jobs_push on public.checkout_jobs;
create trigger trg_checkout_jobs_push
    after update on public.checkout_jobs
    for each row
    when (old.status is distinct from new.status or old.result is distinct from new.result)
    execute function public.checkout_jobs_push();
