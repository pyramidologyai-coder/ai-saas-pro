-- 1. Add timezone to tenants for global AI scaling (Default to Egypt)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Africa/Cairo';

-- 2. Enforce Concurrency Lock (Double-Booking Prevention)
-- This creates a strict unique lock on the exact time and team member.
-- If the AI tries to book 2 people at the same time for the same doctor, the database will reject the second one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_booking_member_time 
ON bookings (team_member_id, booking_time) 
WHERE team_member_id IS NOT NULL AND status != 'cancelled';

-- 3. Reminder: Cascade Deletes
-- To ensure Data Privacy, please verify in Supabase Dashboard -> Database -> Foreign Keys
-- that foreign keys for (bookings, messages, team_members, etc) pointing to tenant_id
-- have the Action "Cascade" on Delete. This ensures if you delete a tenant, all their data is wiped.
