-- 1. جدول الباقات الأساسية
CREATE TABLE IF NOT EXISTS plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE CHECK (slug IN ('starter','growth','pro','vip')),
  price_monthly DECIMAL NOT NULL,
  price_yearly DECIMAL NOT NULL,
  messages_limit INT NOT NULL,
  voice_minutes_limit DECIMAL NOT NULL,
  reminder_enabled BOOLEAN DEFAULT FALSE,
  voice_reminder_enabled BOOLEAN DEFAULT FALSE,
  reminder_credits INT DEFAULT 0,
  extra_500_price DECIMAL DEFAULT 99,
  extra_1000_price DECIMAL DEFAULT 179,
  extra_5000_price DECIMAL DEFAULT 799,
  features JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 2. جدول أسعار الوكالات
CREATE TABLE IF NOT EXISTS agency_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  plan_slug TEXT NOT NULL CHECK (plan_slug IN ('starter','growth','pro','vip')),
  master_price_monthly DECIMAL NOT NULL,
  master_price_yearly DECIMAL NOT NULL,
  agency_price_monthly DECIMAL NOT NULL,
  agency_price_yearly DECIMAL NOT NULL,
  margin_monthly DECIMAL GENERATED ALWAYS AS (agency_price_monthly - master_price_monthly) STORED,
  margin_yearly DECIMAL GENERATED ALWAYS AS (agency_price_yearly - master_price_yearly) STORED,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(agency_id, plan_slug)
);

-- 3. أعمدة جديدة في agencies
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS messages_used INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS messages_limit INT DEFAULT 1000,
ADD COLUMN IF NOT EXISTS voice_minutes_used DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS voice_minutes_limit DECIMAL DEFAULT 60;

-- 4. أعمدة جديدة في tenants
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'clinic' CHECK (business_type IN ('clinic','restaurant','salon','realestate','store','cars')),
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'starter' CHECK (plan_type IN ('starter','growth','pro','vip')),
ADD COLUMN IF NOT EXISTS messages_used INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS messages_limit INT DEFAULT 1000,
ADD COLUMN IF NOT EXISTS voice_minutes_used DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS voice_minutes_limit DECIMAL DEFAULT 60,
ADD COLUMN IF NOT EXISTS subscription_end_date DATE;

-- 5. RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_read_plans" ON plans FOR SELECT USING (TRUE);
CREATE POLICY "master_manage_plans" ON plans FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'master_admin');

CREATE POLICY "master_read_agency_plans" ON agency_plans FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'master_admin');
CREATE POLICY "agency_manage_own_plans" ON agency_plans FOR ALL USING (agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid()));

-- 6. Functions & Triggers
CREATE OR REPLACE FUNCTION check_agency_price_above_master()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.agency_price_monthly < NEW.master_price_monthly THEN
    RAISE EXCEPTION 'سعر الوكالة لا يمكن أن يكون أقل من سعر الماستر';
  END IF;
  IF NEW.agency_price_yearly < NEW.master_price_yearly THEN
    RAISE EXCEPTION 'السعر السنوي لا يمكن أن يكون أقل من سعر الماستر';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_agency_price ON agency_plans;
CREATE TRIGGER validate_agency_price
BEFORE INSERT OR UPDATE ON agency_plans
FOR EACH ROW EXECUTE FUNCTION check_agency_price_above_master();

-- 7. Insert Defaults
INSERT INTO plans (name, slug, price_monthly, price_yearly, messages_limit, voice_minutes_limit, reminder_enabled, voice_reminder_enabled, reminder_credits) VALUES
('Starter','starter',999,799,1000,60, FALSE,FALSE,0),
('Growth','growth',1999,1599,5000,200, TRUE,FALSE,500),
('Pro','pro',3499,2799,20000,600, TRUE,TRUE,2000),
('VIP','vip',6999,5599,-1,-1, TRUE,TRUE,-1)
ON CONFLICT (slug) DO NOTHING;
