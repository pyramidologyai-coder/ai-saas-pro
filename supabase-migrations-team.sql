-- Create team_members table for Multi-Doctor / Multi-Manager support
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role_or_specialty TEXT,
  working_hours TEXT,
  google_calendar_refresh_token TEXT,
  google_calendar_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add team_member_id to bookings table to know who the booking is for
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL;
