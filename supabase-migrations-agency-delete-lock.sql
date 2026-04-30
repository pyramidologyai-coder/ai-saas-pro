-- ========================================================
-- DATA DESTRUCTION SHIELD (Anti-Extortion Defense)
-- ========================================================
-- Prevents Agencies from maliciously deleting end-client 
-- accounts. Agencies can only "suspend" accounts.
-- True deletion is reserved for the Master Admin.

CREATE OR REPLACE FUNCTION prevent_agency_deletions()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow bypass if it is the Master Admin
    IF auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com') THEN
        RETURN OLD;
    END IF;

    -- Block all other deletions (Agencies and Tenants themselves)
    RAISE EXCEPTION 'Security Violation: Deletion of tenants is strictly prohibited. Please suspend the account instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_tenant_deletions ON tenants;

CREATE TRIGGER block_tenant_deletions
BEFORE DELETE ON tenants
FOR EACH ROW
EXECUTE FUNCTION prevent_agency_deletions();
