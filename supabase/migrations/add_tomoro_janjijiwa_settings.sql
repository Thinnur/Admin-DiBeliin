-- =============================================================================
-- Migration: Add Default Tomoro Coffee & Janji Jiwa Operational/Fee Settings
-- =============================================================================

INSERT INTO app_settings (key, value, description)
VALUES 
  ('is_tomoro_open', 'true', 'Status operasional Tomoro Coffee'),
  ('is_janjijiwa_open', 'true', 'Status operasional Kopi Janji Jiwa'),
  ('fee_jasdor_tomoro', '2000', 'Biaya Jasdor untuk Tomoro Coffee'),
  ('fee_jasdor_janjijiwa', '2000', 'Biaya Jasdor untuk Kopi Janji Jiwa')
ON CONFLICT (key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;
