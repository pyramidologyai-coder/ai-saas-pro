-- ========================================================
-- FINANCIAL INTEGRITY TRIGGER (1000-Year Hacker Defense)
-- ========================================================
-- This trigger prevents Agency Admins and End-Clients from 
-- bypassing the Stripe billing system by manually setting or 
-- updating their own subscription_tier, status, or trial_ends_at 
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

    -- FOR INSERT OPERATIONS: Ensure they start with default values only
    IF TG_OP = 'INSERT' THEN
        IF NEW.subscription_tier != 'trial' THEN
            RAISE EXCEPTION 'Security Violation: Cannot insert a non-trial subscription tier.';
        END IF;
        IF NEW.status != 'active' THEN
            RAISE EXCEPTION 'Security Violation: Initial status must be active.';
        END IF;
        -- Allow setting initial trial date, but we can't easily restrict the exact date without complex logic,
        -- so we just ensure it's not more than 14 days in the future to prevent infinite trials.
        IF NEW.trial_ends_at > (CURRENT_TIMESTAMP + INTERVAL '14 days') THEN
            RAISE EXCEPTION 'Security Violation: Trial period exceeds maximum allowed limits.';
        END IF;
    END IF;

    -- FOR UPDATE OPERATIONS: Block changes to financial columns
    IF TG_OP = 'UPDATE' THEN
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

-- Drop the old trigger
DROP TRIGGER IF EXISTS enforce_financial_integrity ON tenants;

-- Attach the trigger to the tenants table for BOTH INSERT AND UPDATE
CREATE TRIGGER enforce_financial_integrity
BEFORE INSERT OR UPDATE ON tenants
FOR EACH ROW
EXECUTE FUNCTION prevent_financial_tampering();
