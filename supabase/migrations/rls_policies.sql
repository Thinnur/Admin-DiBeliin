-- =============================================================================
-- DiBeliin Admin - Row Level Security (RLS) Policies
-- =============================================================================
-- Mengaktifkan RLS pada tabel `transactions` dan `accounts` agar hanya
-- authenticated users yang bisa melakukan operasi CRUD.
--
-- PENTING: Jalankan skrip ini di Supabase SQL Editor.
-- Setelah RLS aktif, request tanpa token auth yang valid akan ditolak,
-- bahkan jika API key (anon key) terekspos.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabel: transactions
-- ---------------------------------------------------------------------------

-- Aktifkan RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada (aman untuk re-run)
DROP POLICY IF EXISTS "Authenticated users can read transactions"   ON transactions;
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can update transactions" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can delete transactions" ON transactions;

-- SELECT: Hanya user yang sudah login bisa melihat data
CREATE POLICY "Authenticated users can read transactions"
    ON transactions FOR SELECT
    TO authenticated
    USING (true);

-- INSERT: Hanya user yang sudah login bisa menambah data
CREATE POLICY "Authenticated users can insert transactions"
    ON transactions FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE: Hanya user yang sudah login bisa mengubah data
CREATE POLICY "Authenticated users can update transactions"
    ON transactions FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE: Hanya user yang sudah login bisa menghapus data
CREATE POLICY "Authenticated users can delete transactions"
    ON transactions FOR DELETE
    TO authenticated
    USING (true);

-- ---------------------------------------------------------------------------
-- 2. Tabel: accounts
-- ---------------------------------------------------------------------------

-- Aktifkan RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada (aman untuk re-run)
DROP POLICY IF EXISTS "Authenticated users can read accounts"   ON accounts;
DROP POLICY IF EXISTS "Authenticated users can insert accounts" ON accounts;
DROP POLICY IF EXISTS "Authenticated users can update accounts" ON accounts;
DROP POLICY IF EXISTS "Authenticated users can delete accounts" ON accounts;

-- SELECT
CREATE POLICY "Authenticated users can read accounts"
    ON accounts FOR SELECT
    TO authenticated
    USING (true);

-- INSERT
CREATE POLICY "Authenticated users can insert accounts"
    ON accounts FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE
CREATE POLICY "Authenticated users can update accounts"
    ON accounts FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE
CREATE POLICY "Authenticated users can delete accounts"
    ON accounts FOR DELETE
    TO authenticated
    USING (true);
