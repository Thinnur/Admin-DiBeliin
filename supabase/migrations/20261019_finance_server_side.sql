-- =============================================================================
-- Finance: pencarian, ringkasan filter & grafik tren dihitung di DB. 2026-10-19.
-- Sebelumnya Finance menarik SEMUA baris transactions di periode terpilih
-- (mode Semua Waktu = 16.000+ baris, berurutan per 1000) lalu menyaring,
-- menjumlah & menggambar grafik di browser. Sekarang tabel diambil per
-- halaman, angka-angkanya diagregasi di sini.
-- SECURITY INVOKER: ikut RLS transactions (cuma authenticated).
-- Web tetap jalan sebelum fungsi ini dipasang (fallback ke cara lama).
-- =============================================================================

-- Baris transaksi yang cocok dengan periode + kata kunci. Tipe, kategori,
-- urutan & halaman ditambahkan klien lewat PostgREST (.eq/.order/.range).
-- label_categories: kategori yang LABEL tampilannya cocok dengan kata kunci
-- (mis. "otomasi" -> qris_income); labelnya cuma ada di web.
create or replace function public.finance_search_transactions(
    start_date timestamptz default null,
    end_date timestamptz default null,
    q text default null,
    label_categories text[] default null
)
returns setof public.transactions
language sql
stable
security invoker
set search_path = public
as $$
    select t.*
    from public.transactions t
    where (start_date is null or t.created_at >= start_date)
      and (end_date is null or t.created_at <= end_date)
      and (
          coalesce(btrim(q), '') = ''
          or t.description ilike '%' || btrim(q) || '%'
          or replace(t.category, '_', ' ') ilike '%' || btrim(q) || '%'
          or t.category ilike '%' || btrim(q) || '%'
          or t.category = any(label_categories)
          or (
              regexp_replace(q, '\D', '', 'g') <> ''
              and regexp_replace(t.amount::text, '\D', '', 'g')
                  like '%' || regexp_replace(q, '\D', '', 'g') || '%'
          )
      );
$$;

-- Ringkasan untuk filter aktif (tipe/kategori/kata kunci) di periode terpilih.
create or replace function public.get_finance_filtered_summary(
    start_date timestamptz default null,
    end_date timestamptz default null,
    q text default null,
    label_categories text[] default null,
    p_type text default null,
    p_category text default null
)
returns json
language sql
stable
security invoker
set search_path = public
as $$
    select json_build_object(
        'income', coalesce(sum(t.amount) filter (where t.transaction_type::text = 'income'), 0),
        'expense', coalesce(sum(t.amount) filter (where t.transaction_type::text <> 'income'), 0)
    )
    from public.finance_search_transactions(start_date, end_date, q, label_categories) t
    where (p_type is null or t.transaction_type::text = p_type)
      and (p_category is null or t.category = p_category);
$$;

-- Income & expense per hari (zona waktu browser admin) buat grafik tren.
create or replace function public.get_daily_finance_trend(
    start_date timestamptz default null,
    end_date timestamptz default null,
    tz text default 'Asia/Jakarta'
)
returns table (day date, income numeric, expense numeric)
language sql
stable
security invoker
set search_path = public
as $$
    select (t.created_at at time zone tz)::date as day,
           coalesce(sum(t.amount) filter (where t.transaction_type::text = 'income'), 0),
           coalesce(sum(t.amount) filter (where t.transaction_type::text <> 'income'), 0)
    from public.transactions t
    where (start_date is null or t.created_at >= start_date)
      and (end_date is null or t.created_at <= end_date)
    group by 1
    order by 1;
$$;

grant execute on function public.finance_search_transactions(timestamptz, timestamptz, text, text[]) to authenticated;
grant execute on function public.get_finance_filtered_summary(timestamptz, timestamptz, text, text[], text, text) to authenticated;
grant execute on function public.get_daily_finance_trend(timestamptz, timestamptz, text) to authenticated;
