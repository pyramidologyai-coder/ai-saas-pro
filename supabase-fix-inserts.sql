-- 1. سياسات الإدخال لجدول الخدمات (items)
DROP POLICY IF EXISTS allow_insert_items ON items;
CREATE POLICY allow_insert_items ON items FOR INSERT 
WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid() OR agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())));

-- 2. سياسات الإدخال لجدول الفروع (branches)
DROP POLICY IF EXISTS allow_insert_branches ON branches;
CREATE POLICY allow_insert_branches ON branches FOR INSERT 
WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid() OR agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())));

-- 3. سياسات الإدخال لجدول فريق العمل (team_members)
DROP POLICY IF EXISTS allow_insert_team ON team_members;
CREATE POLICY allow_insert_team ON team_members FOR INSERT 
WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid() OR agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())));
