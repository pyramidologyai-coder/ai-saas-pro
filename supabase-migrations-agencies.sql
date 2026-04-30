CREATE TABLE IF NOT EXISTS agencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- The Auth user who owns this agency
  name TEXT NOT NULL,
  custom_domain TEXT UNIQUE,
  logo_url TEXT,
  subscription_status TEXT DEFAULT 'active',
  gemini_api_key TEXT, -- Optional BYOK
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Link tenants to agencies
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL;
