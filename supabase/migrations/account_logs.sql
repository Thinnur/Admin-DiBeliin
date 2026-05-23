CREATE TABLE IF NOT EXISTS account_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id    UUID REFERENCES accounts(id) ON DELETE SET NULL,
  account_phone TEXT NOT NULL DEFAULT '',
  account_brand TEXT NOT NULL DEFAULT '',
  user_email    TEXT NOT NULL,
  action        TEXT NOT NULL,
  description   TEXT NOT NULL,
  metadata      JSONB DEFAULT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_logs_account_id ON account_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_account_logs_created_at ON account_logs(created_at DESC);

ALTER TABLE account_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read account logs" ON account_logs;
DROP POLICY IF EXISTS "Authenticated users can insert account logs" ON account_logs;

CREATE POLICY "Authenticated users can read account logs"
  ON account_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert account logs"
  ON account_logs FOR INSERT TO authenticated WITH CHECK (true);
