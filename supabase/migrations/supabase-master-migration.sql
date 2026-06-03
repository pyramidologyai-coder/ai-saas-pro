-- ========================================================
-- 2126 MASTER MIGRATION SCRIPT (THE CORE)
-- Use this script to initialize or reset the entire system.
-- ========================================================

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. CREATE CORE TABLES

-- Platform Settings (KMS Fallback & Global Config)
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_base_fee DECIMAL(10,2) DEFAULT 0,
  agency_percentage DECIMAL(5,2) DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agencies (White-Label Resellers)
CREATE TABLE IF NOT EXISTS agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name VARCHAR(255) NOT NULL,
  custom_domain VARCHAR(255),
  stripe_account_id VARCHAR(255),
  paymob_api_key TEXT,
  subscription_status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tenants (The End-Clients: Clinics, Restaurants, etc.)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  agency_id UUID REFERENCES agencies(id),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(50) DEFAULT 'clinic',
  subscription_tier VARCHAR(50) DEFAULT 'trial',
  status VARCHAR(50) DEFAULT 'active',
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  meta_token TEXT,
  whatsapp_number_id VARCHAR(255),
  zapier_webhook TEXT,
  google_calendar_refresh_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Branches
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  ai_status VARCHAR(50) DEFAULT 'Online'
);

-- Team Members (Doctors, Stylists, etc.)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  name VARCHAR(255) NOT NULL,
  role_or_specialty VARCHAR(255),
  google_calendar_refresh_token TEXT
);

-- Bookings (Appointments / Orders)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  team_member_id UUID REFERENCES team_members(id),
  branch_id UUID REFERENCES branches(id),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50) NOT NULL,
  booking_time TIMESTAMP WITH TIME ZONE NOT NULL,
  service_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'confirmed',
  source VARCHAR(50) DEFAULT 'whatsapp',
  google_event_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, team_member_id, booking_time) -- Double Booking Lock
);

-- Messages (WhatsApp Chat History for AI)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL, -- WhatsApp Number
  sender VARCHAR(50) NOT NULL, -- 'incoming' or 'outgoing'
  text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Multilingual WhatsApp Templates
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  language VARCHAR(10) DEFAULT 'ar',
  intent VARCHAR(50) NOT NULL,
  template_text TEXT NOT NULL,
  UNIQUE(tenant_id, language, intent)
);

-- Audit Logs (2126 Security Monitoring)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users,
  action_type VARCHAR(255) NOT NULL,
  entity_id UUID,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. HIGH-PERFORMANCE INDEXING
CREATE INDEX IF NOT EXISTS idx_tenants_agency_id ON tenants(agency_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Agency Access
DROP POLICY IF EXISTS agency_owner_access ON agencies;
CREATE POLICY agency_owner_access ON agencies FOR ALL USING (user_id = auth.uid());

-- Tenant Access (Owner OR Agency)
DROP POLICY IF EXISTS tenant_owner_access ON tenants;
CREATE POLICY tenant_owner_access ON tenants FOR ALL USING (user_id = auth.uid() OR agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid()));

-- Templates Access
DROP POLICY IF EXISTS template_owner_access ON whatsapp_templates;
CREATE POLICY template_owner_access ON whatsapp_templates FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid() OR agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())));

-- 5. TRIGGERS (Lockdown Protections)
-- Prevent Tenants from modifying their own trial periods or subscription status
CREATE OR REPLACE FUNCTION protect_billing_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        -- Only Service Role (Admin) can change status/tier
        IF NEW.status IS DISTINCT FROM OLD.status OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
            RAISE EXCEPTION 'HACKER ALERT: Only Master Admin can modify billing fields.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protect_billing_fields ON tenants;
CREATE TRIGGER trigger_protect_billing_fields
BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION protect_billing_fields();

-- ========================================================
-- END OF MIGRATION
-- ========================================================
