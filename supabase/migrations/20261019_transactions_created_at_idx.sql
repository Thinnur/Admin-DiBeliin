-- =============================================================================
-- Indeks created_at buat halaman Finance. 2026-10-19.
-- Semua query Finance (daftar per periode, ringkasan, sidik jari 30 dtk)
-- menyaring/mengurutkan transactions by created_at; tanpa indeks tiap query
-- = scan seluruh tabel (16.000+ baris dan terus bertambah).
-- CONCURRENTLY: tabel tidak terkunci saat dibuat; jalankan di luar transaksi.
-- =============================================================================

create index concurrently if not exists transactions_created_at_idx
    on public.transactions (created_at desc);
