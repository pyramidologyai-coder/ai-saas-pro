-- Step 1: Add new columns to agencies table
ALTER TABLE agencies 
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS messages_used INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS messages_limit INT DEFAULT 1000,
ADD COLUMN IF NOT EXISTS voice_minutes_used DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS voice_minutes_limit DECIMAL DEFAULT 60;

-- Step 2: Add new columns to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'starter',
ADD COLUMN IF NOT EXISTS messages_used INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS messages_limit INT DEFAULT 1000,
ADD COLUMN IF NOT EXISTS voice_minutes_used DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS voice_minutes_limit DECIMAL DEFAULT 60,
ADD COLUMN IF NOT EXISTS subscription_end_date DATE;

-- Step 3: Configure RLS for agencies table
-- Master Admin can read all agencies
CREATE POLICY "master_read_agencies" ON agencies
FOR SELECT USING (
  auth.jwt() ->> 'email' = ANY(
    string_to_array(current_setting('app.super_admin_emails', true), ',')
  )
);

-- Super Admin can read their own agency
CREATE POLICY "agency_owner_read_own" ON agencies
FOR SELECT USING (
  user_id = auth.uid()
);

-- Only Master Admin can update commission_rate
CREATE POLICY "master_update_commission" ON agencies
FOR UPDATE USING (
  auth.jwt() ->> 'email' = ANY(
    string_to_array(current_setting('app.super_admin_emails', true), ',')
  )
);

-- Step 4: Configure RLS for tenants table
-- Master Admin can read all tenants
CREATE POLICY "master_read_tenants" ON tenants
FOR SELECT USING (
  auth.jwt() ->> 'email' = ANY(
    string_to_array(current_setting('app.super_admin_emails', true), ',')
  )
);

-- Super Admin can read tenants belonging to their agency
CREATE POLICY "agency_read_own_tenants" ON tenants
FOR SELECT USING (
  agency_id IN (
    SELECT id FROM agencies WHERE user_id = auth.uid()
  )
);

-- Admin can read only their own tenant data
CREATE POLICY "admin_read_own" ON tenants
FOR SELECT USING (
  user_id = auth.uid()
);
