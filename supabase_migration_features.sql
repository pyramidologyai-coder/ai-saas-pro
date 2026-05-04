-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now(),
  success BOOLEAN DEFAULT TRUE,
  details JSONB
);

-- 2. Add Check-in System columns to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS check_in_status TEXT 
  DEFAULT 'pending'
  CHECK (check_in_status IN ('pending', 'checked_in', 'no_show', 'late')),
ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS check_in_by UUID,
ADD COLUMN IF NOT EXISTS revenue_confirmed BOOLEAN DEFAULT FALSE;

-- 3. Add Reminder & Package columns to tenants
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_credits INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS voice_reminder_enabled BOOLEAN DEFAULT FALSE;
