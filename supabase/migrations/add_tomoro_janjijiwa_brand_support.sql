-- =============================================================================
-- Migration: Add Tomoro & Janji Jiwa support to DB constraints and enums
-- =============================================================================

-- 1. Add new brand values to account_brand enum type
ALTER TYPE account_brand ADD VALUE IF NOT EXISTS 'tomoro';
ALTER TYPE account_brand ADD VALUE IF NOT EXISTS 'janjijiwa';

-- 2. Update outlets brand check constraint to allow tomoro and janjijiwa
ALTER TABLE public.outlets DROP CONSTRAINT IF EXISTS outlets_brand_check;
ALTER TABLE public.outlets ADD CONSTRAINT outlets_brand_check CHECK (((brand)::text = ANY (ARRAY['fore'::text, 'kenangan'::text, 'tomoro'::text, 'janjijiwa'::text])));

-- 3. Update vouchers valid_for check constraint to allow tomoro and janjijiwa
ALTER TABLE public.vouchers DROP CONSTRAINT IF EXISTS vouchers_valid_for_check;
ALTER TABLE public.vouchers ADD CONSTRAINT vouchers_valid_for_check CHECK ((valid_for = ANY (ARRAY['fore'::text, 'kenangan'::text, 'tomoro'::text, 'janjijiwa'::text, 'all'::text])));
