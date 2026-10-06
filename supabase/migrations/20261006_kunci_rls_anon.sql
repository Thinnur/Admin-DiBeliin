-- =============================================================================
-- Kunci akses anon (anon key yang tercantum di web) ke tabel internal.
-- 2026-10-06. Sebelum ini, tanpa login siapa pun bisa BACA + TULIS:
--   accounts (nomor HP + password), transactions, api_configs (token API
--   Kopken/Tomoro), app_settings (buka/tutup toko, biaya), dan checkout_jobs /
--   dawg_accounts yang RLS-nya mati total.
--
-- Pemakai sah tetap jalan:
--   - web admin  -> role authenticated (policy di bawah / yang sudah ada)
--   - worker VPS + laptop, qris-api, edge function, cron -> service_role
--     (melewati RLS; dicek: semua .env ber-role service_role)
--   - web pelanggan (DIBeliin) -> anon, cuma baca app_settings, menu/outlet,
--     qris_orders per id -> tetap dibuka (qris_orders tidak diubah di sini)
--
-- Belum dicakup: pemisahan staff vs super_admin di level DB (staff masih bisa
-- baca accounts lewat API karena sama-sama authenticated), dan qris_orders
-- yang masih bisa di-list anon (web pelanggan butuh baca per id + realtime).
-- =============================================================================

begin;

-- accounts / transactions: buang policy "sementara" yang membuka ke public.
-- Policy authenticated (CRUD) yang sudah ada tetap.
drop policy if exists "Enable all access for now" on public.accounts;
drop policy if exists "Enable all access for now" on public.transactions;

-- api_configs: token API brand. Cuma admin (Operational > API Sync) + service.
drop policy if exists "Allow public insert api_configs" on public.api_configs;
drop policy if exists "Allow public read api_configs" on public.api_configs;
drop policy if exists "Allow public update api_configs" on public.api_configs;
create policy api_configs_auth_all on public.api_configs
    for all to authenticated using (true) with check (true);

-- app_settings: web pelanggan baca status toko/biaya/wifi/popup -> anon boleh
-- BACA, kecuali kunci internal admin. Tulis cuma authenticated.
drop policy if exists "Enable all access" on public.app_settings;
create policy app_settings_anon_read on public.app_settings
    for select to anon
    using (key not in ('kopken_blu_accounts', 'kopken_default_payment'));
create policy app_settings_auth_all on public.app_settings
    for all to authenticated using (true) with check (true);

-- checkout_jobs / dawg_accounts: RLS sebelumnya mati.
alter table public.checkout_jobs enable row level security;
create policy checkout_jobs_auth_all on public.checkout_jobs
    for all to authenticated using (true) with check (true);

alter table public.dawg_accounts enable row level security;
create policy dawg_accounts_auth_all on public.dawg_accounts
    for all to authenticated using (true) with check (true);

-- RPC admin/worker yang tadinya bisa dipanggil anon.
-- (get_widget_dibeliin sengaja tidak disentuh: punya overload ber-apikey sendiri.)
revoke execute on function public.get_financial_summary from anon, public;
revoke execute on function public.attach_checkout_job from anon, public;
revoke execute on function public.claim_dawg_voucher from anon, public;
revoke execute on function public.restore_dawg_voucher from anon, public;
grant execute on function public.get_financial_summary to authenticated, service_role;
grant execute on function public.attach_checkout_job to authenticated, service_role;
grant execute on function public.claim_dawg_voucher to authenticated, service_role;
grant execute on function public.restore_dawg_voucher to authenticated, service_role;

commit;

-- =============================================================================
-- ROLLBACK (kembali persis ke keadaan sebelum migrasi ini):
-- begin;
-- create policy "Enable all access for now" on public.accounts for all to public using (true);
-- create policy "Enable all access for now" on public.transactions for all to public using (true);
-- drop policy if exists api_configs_auth_all on public.api_configs;
-- create policy "Allow public insert api_configs" on public.api_configs for insert to public with check (true);
-- create policy "Allow public read api_configs" on public.api_configs for select to public using (true);
-- create policy "Allow public update api_configs" on public.api_configs for update to public using (true) with check (true);
-- drop policy if exists app_settings_anon_read on public.app_settings;
-- drop policy if exists app_settings_auth_all on public.app_settings;
-- create policy "Enable all access" on public.app_settings for all to public using (true);
-- drop policy if exists checkout_jobs_auth_all on public.checkout_jobs;
-- alter table public.checkout_jobs disable row level security;
-- drop policy if exists dawg_accounts_auth_all on public.dawg_accounts;
-- alter table public.dawg_accounts disable row level security;
-- grant execute on function public.get_financial_summary, public.attach_checkout_job,
--     public.claim_dawg_voucher, public.restore_dawg_voucher to anon;
-- commit;
-- =============================================================================
