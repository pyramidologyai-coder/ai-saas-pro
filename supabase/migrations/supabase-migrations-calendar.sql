-- Add Google Calendar fields to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS google_calendar_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_calendar_email TEXT;
