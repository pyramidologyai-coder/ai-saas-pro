ALTER TABLE agencies 
ADD COLUMN IF NOT EXISTS stripe_public_key TEXT,
ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT,
ADD COLUMN IF NOT EXISTS paymob_api_key TEXT,
ADD COLUMN IF NOT EXISTS paymob_integration_id TEXT;
