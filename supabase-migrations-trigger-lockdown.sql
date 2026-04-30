-- ========================================================
-- FINANCIAL INTEGRITY TRIGGER (1000-Year Hacker Defense)
-- ========================================================
-- This trigger prevents Agency Admins and End-Clients from 
-- bypassing the Stripe billing system by manually updating
-- their own subscription_tier, trial_ends_at, or agency_id 
-- directly via the API. Only the Master Admin or Service Role
-- can alter these financial columns.

CREATE OR REPLACE FUNCTION prevent_financial_tampering()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow bypass if it is the Service Role (Webhooks)
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Allow bypass if it is the Master Admin
    IF auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com') THEN
        RETURN NEW;
    END IF;

    -- For everyone else (Agencies and Tenants), block changes to financial columns
    IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
        RAISE EXCEPTION 'Security Violation: Cannot manually alter subscription tier.';
    END IF;

    IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
        RAISE EXCEPTION 'Security Violation: Cannot manually alter trial expiration date.';
    END IF;

    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
        RAISE EXCEPTION 'Security Violation: Cannot manually reassign agency ownership.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists to allow re-running the migration safely
DROP TRIGGER IF EXISTS enforce_financial_integrity ON tenants;

-- Attach the trigger to the tenants table
CREATE TRIGGER enforce_financial_integrity
BEFORE UPDATE ON tenants
FOR EACH ROW
EXECUTE FUNCTION prevent_financial_tampering();
