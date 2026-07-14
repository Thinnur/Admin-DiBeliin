-- =============================================================================
-- Migration: Add DiBeliin Tiket (Cinema) Service Status Setting
-- =============================================================================

INSERT INTO app_settings (key, value, description)
VALUES
  ('is_cinema_open', 'true', 'Status checkout layanan DiBeliin Tiket (nonton bioskop)')
ON CONFLICT (key)
DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;
