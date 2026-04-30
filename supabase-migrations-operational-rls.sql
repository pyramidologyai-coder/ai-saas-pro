-- ========================================================
-- END-CLIENT DATA ISOLATION PATCH (IDOR / GDPR FIX)
-- ========================================================
-- Enables Row Level Security on the operational tables 
-- (bookings, items, branches, messages) to prevent clinics 
-- from stealing or deleting each other's data.

-- 1. Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 2. Master Admin Access (Full Access)
CREATE POLICY master_admin_bookings ON bookings FOR ALL USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));
CREATE POLICY master_admin_items ON items FOR ALL USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));
CREATE POLICY master_admin_branches ON branches FOR ALL USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));
CREATE POLICY master_admin_messages ON messages FOR ALL USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));

-- 3. Tenant Access (Strict Isolation)
-- A tenant can only access data if the tenant_id belongs to them.
-- We verify ownership by checking if the user_id of the tenant matches auth.uid()

-- Bookings
CREATE POLICY tenant_bookings_access ON bookings FOR ALL 
USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

-- Items
CREATE POLICY tenant_items_access ON items FOR ALL 
USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

-- Branches
CREATE POLICY tenant_branches_access ON branches FOR ALL 
USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

-- Messages
CREATE POLICY tenant_messages_access ON messages FOR ALL 
USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

-- 4. Allow Public Inserts for Bookings/Messages (Web Widget)
-- The Chat Widget and API must be able to insert bookings and messages without being logged in.
-- But they cannot read or update existing data.
CREATE POLICY public_insert_bookings ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY public_insert_messages ON messages FOR INSERT WITH CHECK (true);

-- Allow public read of items and branches for the chatbot to answer questions
CREATE POLICY public_read_items ON items FOR SELECT USING (true);
CREATE POLICY public_read_branches ON branches FOR SELECT USING (true);
