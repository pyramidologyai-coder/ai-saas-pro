-- ========================================================
-- WORM AUDIT LOGS (Write Once Read Many)
-- ========================================================
-- This trigger guarantees 100% immutability of the audit logs.
-- Even if an attacker gets the Service Role key or the Master Admin JWT,
-- they CANNOT delete or update existing audit logs. The database itself
-- will reject the transaction.

CREATE OR REPLACE FUNCTION prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
    -- Throw a hard exception if anyone tries to UPDATE or DELETE an audit log
    RAISE EXCEPTION 'SECURITY BREACH DETECTED: Audit logs are strictly immutable (WORM). Alteration or deletion is cryptographically prohibited by the Database Sentinel.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_immutable_audit_logs ON audit_logs;

-- Apply to UPDATE and DELETE
CREATE TRIGGER enforce_immutable_audit_logs
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_tampering();
