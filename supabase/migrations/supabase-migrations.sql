-- Run this script in the Supabase SQL Editor

-- 1. Add tracking columns for the notifications to the bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS followup_sent BOOLEAN DEFAULT FALSE;

-- 2. Add google_review_link to the tenants table so each clinic has its own review link
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS google_review_link TEXT DEFAULT 'https://g.page/review/example';

-- 3. Just for testing right now, let's update your clinic with a real link
UPDATE tenants 
SET google_review_link = 'https://g.page/review/YOUR_CLINIC_LINK' 
WHERE name = 'عيادة الحياة الطبية'; -- Change to your clinic name if different
