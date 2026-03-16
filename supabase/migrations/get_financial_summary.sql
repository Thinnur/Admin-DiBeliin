-- =============================================================================
-- DiBeliin Admin - Financial Summary RPC
-- =============================================================================
-- Fungsi RPC untuk menghitung total_income, total_expense, dan net_profit
-- langsung di sisi database menggunakan agregasi SQL.
--
-- Cara pakai: Jalankan skrip ini di Supabase SQL Editor.
-- Setelah itu, panggil dari klien: supabase.rpc('get_financial_summary', { ... })
-- =============================================================================

CREATE OR REPLACE FUNCTION get_financial_summary(
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date   TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_income',
        COALESCE(SUM(CASE WHEN transaction_type = 'income'  THEN amount ELSE 0 END), 0),
        'total_expense',
        COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0),
        'net_profit',
        COALESCE(SUM(CASE WHEN transaction_type = 'income'  THEN amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0)
    ) INTO result
    FROM transactions
    WHERE
        (start_date IS NULL OR created_at >= start_date)
        AND
        (end_date IS NULL OR created_at <= end_date);

    RETURN result;
END;
$$;
