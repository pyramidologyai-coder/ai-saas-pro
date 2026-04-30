-- Global Payout Configuration for Tenants (Clinics/Restaurants)
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS payout_gateway TEXT DEFAULT 'none', -- 'paymob', 'stripe', 'none'
ADD COLUMN IF NOT EXISTS payout_account_id TEXT, -- IBAN, Wallet Number, or Stripe Connect ID
ADD COLUMN IF NOT EXISTS kyc_document_url TEXT; -- Identity or Commercial Register Document

-- Global Payout Configuration for Agencies (Resellers)
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS payout_gateway TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS payout_account_id TEXT,
ADD COLUMN IF NOT EXISTS kyc_document_url TEXT;
