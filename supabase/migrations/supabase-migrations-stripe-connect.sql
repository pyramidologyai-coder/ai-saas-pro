-- ========================================================
-- STRIPE CONNECT (AGENCY ACCOUNT ID) PATCH
-- ========================================================
-- Adds the 'stripe_account_id' field to agencies for Stripe Connect integration.

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
