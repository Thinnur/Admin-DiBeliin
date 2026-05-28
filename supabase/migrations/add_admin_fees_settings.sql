-- =============================================================================
-- Migration: Add Default Dynamic Admin Fees (Biaya Jasdor) Settings
-- =============================================================================

-- 1. Alter the value column to text if it's currently boolean (to support storing string numeric values)
ALTER TABLE app_settings 
  ALTER COLUMN value TYPE text USING (CASE WHEN value = true THEN 'true' ELSE 'false' END);

-- 2. Add description column if it doesn't exist
ALTER TABLE app_settings 
  ADD COLUMN IF NOT EXISTS description text;

-- 3. Insert default admin fees (Jasdor) into app_settings table
INSERT INTO app_settings (key, value, description)
VALUES 
  ('fee_jasdor_fore', '5000', 'Biaya jasa titip/jasdor untuk brand Fore Coffee'),
  ('fee_jasdor_kopken', '5000', 'Biaya jasa titip/jasdor untuk brand Kopi Kenangan')
ON CONFLICT (key) DO UPDATE 
SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;
