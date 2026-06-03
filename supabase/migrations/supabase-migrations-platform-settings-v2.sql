-- Run this SQL script in your Supabase SQL Editor to support saving new platform configuration fields
ALTER TABLE platform_settings 
ADD COLUMN IF NOT EXISTS support_email TEXT,
ADD COLUMN IF NOT EXISTS resend_api_key TEXT;
