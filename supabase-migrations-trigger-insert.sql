-- ========================================================
-- FINANCIAL INTEGRITY TRIGGER ON INSERT (Zero-Trust)
-- ========================================================
-- Prevents hackers from assigning themselves 'enterprise' 
-- tier or 100-year trials during the initial account creation.

CREATE OR REPLACE FUNCTION enforce_defaults_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Force default trial to 7 days from now (regardless of what the JS client sends)
    NEW.trial_ends_at := (now() + interval '7 days');
    
    -- Force default subscription tier to 'trial' or 'free'
    NEW.subscription_tier := 'trial';
    
    -- Force default status
    NEW.status := 'active';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS secure_tenant_inserts ON tenants;

CREATE TRIGGER secure_tenant_inserts
BEFORE INSERT ON tenants
FOR EACH ROW
EXECUTE FUNCTION enforce_defaults_on_insert();
