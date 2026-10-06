-- =============================================================================
-- Daftar kategori transaksi (unik) buat pilihan kategori di Finance.
-- 2026-10-06. Sebelumnya web menarik kolom category dari SEMUA transaksi
-- (~268 KB) dan server memotongnya di 5000 baris (PGRST_DB_MAX_ROWS) padahal
-- transaksinya 16.000+ -> kategori di luar 5000 baris itu tidak muncul.
-- SECURITY INVOKER: ikut RLS transactions (cuma authenticated).
-- Web tetap jalan sebelum fungsi ini dipasang (fallback ke cara lama).
-- =============================================================================

create or replace function public.get_transaction_categories()
returns table (category text, transaction_type text)
language sql
stable
security invoker
set search_path = public
as $$
    select distinct btrim(t.category), t.transaction_type::text
    from public.transactions t
    where t.category is not null and btrim(t.category) <> '';
$$;

revoke execute on function public.get_transaction_categories() from anon, public;
grant execute on function public.get_transaction_categories() to authenticated, service_role;

-- ROLLBACK: drop function if exists public.get_transaction_categories();
