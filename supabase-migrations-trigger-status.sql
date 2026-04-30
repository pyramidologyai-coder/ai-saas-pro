-- ========================================================
-- ANTI-SUSPENSION BYPASS TRIGGER (Zero-Trust)
-- ========================================================
-- Prevents Clinics (Tenants) and Agencies from manually changing
-- their own 'status' (e.g. from 'suspended' back to 'active')
-- via the Supabase REST API or JS Client.

CREATE OR REPLACE FUNCTION prevent_status_tampering()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow bypass if it is the Service Role (Webhooks & Vercel Backend)
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Allow bypass if it is the Master Admin
    IF auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com') THEN
        RETURN NEW;
    END IF;

    -- For everyone else (Agencies and Tenants), block changes to status
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Security Violation: Cannot manually alter account status.';
    END IF;

    -- Block Tenants from altering financial columns
    IF TG_TABLE_NAME = 'tenants' THEN
        IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
            RAISE EXCEPTION 'Security Violation: Cannot manually alter subscription tier.';
        END IF;

        IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
            RAISE EXCEPTION 'Security Violation: Cannot manually alter trial expiration date.';
        END IF;

        IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
            RAISE EXCEPTION 'Security Violation: Cannot manually reassign agency ownership.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to Tenants
DROP TRIGGER IF EXISTS enforce_financial_integrity ON tenants;
CREATE TRIGGER enforce_financial_integrity
BEFORE UPDATE ON tenants
FOR EACH ROW
EXECUTE FUNCTION prevent_status_tampering();

-- Attach to Agencies
DROP TRIGGER IF EXISTS enforce_agency_status ON agencies;
CREATE TRIGGER enforce_agency_status
BEFORE UPDATE ON agencies
FOR EACH ROW
EXECUTE FUNCTION prevent_status_tampering();
