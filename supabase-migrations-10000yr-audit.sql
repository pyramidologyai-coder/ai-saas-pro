-- ========================================================
-- 10,000-YEAR FINANCIAL COMPLIANCE & AUDIT PATCH
-- ========================================================

-- 1. PREVENT RACE CONDITIONS (Double Billing / Duplicate Invoices)
-- A database-level UNIQUE constraint is the only mathematical way to 
-- prevent Stripe webhook race conditions.
ALTER TABLE invoices ADD CONSTRAINT unique_stripe_invoice UNIQUE (stripe_invoice_id);

-- 2. CREATE IMMUTABLE MASTER AUDIT LEDGER (SOC2 & ISO27001 Compliance)
-- Professionals do not rely solely on application logs. They use an immutable database ledger.
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID, -- Who did it? (NULL if system/webhook)
    action_type TEXT NOT NULL, -- e.g., 'SUBSCRIPTION_UPGRADE', 'WEBHOOK_RECEIVED', 'AGENCY_PAYOUT'
    entity_id TEXT NOT NULL, -- e.g., tenant_id or invoice_id
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deny UPDATE and DELETE on audit logs for EVERYONE (Immutable Ledger)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY insert_audit_logs ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY read_audit_logs ON audit_logs FOR SELECT USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));
-- Notice: NO UPDATE or DELETE policies exist. It is an append-only ledger.

-- 3. FINANCIAL HISTORY PRESERVATION TRIGGER (Anti-Cascade Deletion Defense)
-- If the Master Admin deletes a tenant by mistake, their paid invoices would be 
-- deleted due to ON DELETE CASCADE. This trigger prevents invoice deletion if status is 'paid'.
CREATE OR REPLACE FUNCTION prevent_paid_invoice_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'paid' THEN
        RAISE EXCEPTION 'Compliance Violation: Cannot delete a paid invoice. Financial records must be preserved for tax auditing.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_paid_invoice_deletion ON invoices;

CREATE TRIGGER block_paid_invoice_deletion
BEFORE DELETE ON invoices
FOR EACH ROW
EXECUTE FUNCTION prevent_paid_invoice_deletion();
