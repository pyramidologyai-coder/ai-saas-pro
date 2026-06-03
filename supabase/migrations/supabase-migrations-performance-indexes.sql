-- ==========================================
-- 2126 HIGH-PERFORMANCE INDEXING & TEMPLATES
-- ==========================================

-- 1. Database Indexing for B-Tree Lookups (High Concurrency)
CREATE INDEX IF NOT EXISTS idx_tenants_agency_id ON tenants(agency_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);

-- 2. Multilingual WhatsApp Templates Table
CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    language VARCHAR(10) DEFAULT 'ar', -- 'ar', 'en'
    intent VARCHAR(50) NOT NULL, -- e.g., 'welcome', 'booking_confirmed', 'quota_exceeded'
    template_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, language, intent)
);

-- Enable RLS on templates
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Tenant can read/update their own templates
CREATE POLICY tenant_templates_access ON whatsapp_templates 
    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

-- Agency can read/update templates of their tenants
CREATE POLICY agency_templates_access ON whatsapp_templates 
    FOR ALL USING (tenant_id IN (
        SELECT id FROM tenants WHERE agency_id IN (
            SELECT id FROM agencies WHERE user_id = auth.uid()
        )
    ));
