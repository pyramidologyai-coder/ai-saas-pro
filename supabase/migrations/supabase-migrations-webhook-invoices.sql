-- 1. Create Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT DEFAULT 'paid',
    stripe_invoice_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add Webhook Secret to Agencies
ALTER TABLE agencies 
ADD COLUMN IF NOT EXISTS stripe_webhook_secret TEXT;

-- 3. Add Webhook Secret to Platform Settings (for Master Admin)
ALTER TABLE platform_settings 
ADD COLUMN IF NOT EXISTS stripe_webhook_secret TEXT;
