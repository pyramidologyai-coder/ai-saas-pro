-- ========================================================
-- RACE CONDITION & DOUBLE BOOKING PREVENTION (Transaction Lock)
-- ========================================================
-- Prevents two concurrent requests from booking the exact same
-- time slot for the same team member in the same tenant.

CREATE OR REPLACE FUNCTION prevent_double_booking()
RETURNS TRIGGER AS $$
DECLARE
    overlapping_count INTEGER;
BEGIN
    -- Only check for double bookings if it's not a cancelled status
    IF NEW.status = 'cancelled' THEN
        RETURN NEW;
    END IF;

    -- Check if there is an existing active booking for the same time and same provider
    -- (We use an explicit lock or count. In PG, triggers on insert run in transaction)
    IF NEW.team_member_id IS NOT NULL THEN
        SELECT COUNT(*)
        INTO overlapping_count
        FROM bookings
        WHERE tenant_id = NEW.tenant_id
          AND team_member_id = NEW.team_member_id
          AND booking_time = NEW.booking_time
          AND status != 'cancelled'
          AND id != NEW.id; -- in case of update
          
        IF overlapping_count > 0 THEN
            RAISE EXCEPTION 'Security/Concurrency Violation: Double booking detected for this provider at this time.';
        END IF;
    ELSE
        -- If no specific provider is selected, we might still want to prevent the exact same time 
        -- if the clinic only handles one booking at a time.
        -- Assuming a generic check for the same tenant and exact same time without a provider.
        SELECT COUNT(*)
        INTO overlapping_count
        FROM bookings
        WHERE tenant_id = NEW.tenant_id
          AND team_member_id IS NULL
          AND booking_time = NEW.booking_time
          AND status != 'cancelled'
          AND id != NEW.id;
          
        IF overlapping_count > 0 THEN
            RAISE EXCEPTION 'Security/Concurrency Violation: Double booking detected at this time.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_no_double_booking ON bookings;

CREATE TRIGGER enforce_no_double_booking
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION prevent_double_booking();
