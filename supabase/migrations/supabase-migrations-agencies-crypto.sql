-- 2126 Cyber Security: Add encrypted column for Paymob API Keys and Stripe Account ID
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS paymob_api_key_encrypted text,
ADD COLUMN IF NOT EXISTS stripe_account_id text;
