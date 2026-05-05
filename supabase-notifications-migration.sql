-- ==========================================
-- جدول الإشعارات
-- ==========================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) 
    ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) 
    ON DELETE SET NULL,
  target_role TEXT NOT NULL CHECK (target_role IN (
    'admin', 'super_admin', 'master_admin'
  )),
  type TEXT NOT NULL CHECK (type IN (
    'warning_80', 'warning_95', 'limit_reached',
    'subscription_expiring', 'audio_received'
  )),
  channel TEXT NOT NULL CHECK (channel IN (
    'in_app', 'email', 'both'
  )),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS Policies
-- ==========================================

-- Admin يشوف إشعاراته بس
CREATE POLICY "admin_read_notifications"
ON notifications FOR SELECT USING (
  target_role = 'admin'
  AND tenant_id IN (
    SELECT id FROM tenants 
    WHERE user_id = auth.uid()
  )
);

-- Admin يعدل is_read بس
CREATE POLICY "admin_update_notifications"
ON notifications FOR UPDATE USING (
  target_role = 'admin'
  AND tenant_id IN (
    SELECT id FROM tenants 
    WHERE user_id = auth.uid()
  )
) WITH CHECK (
  target_role = 'admin'
  AND tenant_id IN (
    SELECT id FROM tenants 
    WHERE user_id = auth.uid()
  )
);

-- Super Admin يشوف إشعارات عملاءه بس
-- لو agency_id موجود
CREATE POLICY "super_admin_read_notifications"
ON notifications FOR SELECT USING (
  target_role IN ('super_admin', 'admin')
  AND agency_id IS NOT NULL
  AND agency_id IN (
    SELECT id FROM agencies 
    WHERE user_id = auth.uid()
  )
);

-- Super Admin يعدل is_read
CREATE POLICY "super_admin_update_notifications"
ON notifications FOR UPDATE USING (
  target_role IN ('super_admin', 'admin')
  AND agency_id IS NOT NULL
  AND agency_id IN (
    SELECT id FROM agencies 
    WHERE user_id = auth.uid()
  )
) WITH CHECK (
  target_role IN ('super_admin', 'admin')
  AND agency_id IS NOT NULL
  AND agency_id IN (
    SELECT id FROM agencies 
    WHERE user_id = auth.uid()
  )
);

-- Master Admin يشوف ويعدل كل الإشعارات
CREATE POLICY "master_all_notifications"
ON notifications FOR ALL USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') 
  = 'master_admin'
);

-- ==========================================
-- RPC العداد الذكي
-- ==========================================
CREATE OR REPLACE FUNCTION 
increment_message_usage(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_messages_used INT;
  v_messages_limit INT;
  v_percentage DECIMAL;
BEGIN
  SELECT messages_used, messages_limit
  INTO v_messages_used, v_messages_limit
  FROM tenants
  WHERE id = p_tenant_id
  FOR UPDATE;

  IF v_messages_limit = -1 THEN
    UPDATE tenants 
    SET messages_used = messages_used + 1 
    WHERE id = p_tenant_id;
    RETURN 'ok';
  END IF;

  IF v_messages_used >= v_messages_limit THEN
    RETURN 'limit_reached';
  END IF;

  UPDATE tenants 
  SET messages_used = messages_used + 1 
  WHERE id = p_tenant_id;

  v_percentage := ((v_messages_used + 1.0) / 
    v_messages_limit) * 100;

  IF v_percentage >= 95 THEN
    RETURN 'warning_95';
  ELSIF v_percentage >= 80 THEN
    RETURN 'warning_80';
  ELSE
    RETURN 'ok';
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'increment_message_usage error: %', 
    SQLERRM;
  RETURN 'error';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- RPC الإشعارات مع Rate Limiting
-- ==========================================
CREATE OR REPLACE FUNCTION send_usage_notification(
  p_tenant_id UUID,
  p_agency_id UUID,
  p_type TEXT,
  p_message TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_last_notification TIMESTAMP;
  v_cooldown_hours INT := 6;
BEGIN

  IF p_type NOT IN (
    'warning_80','warning_95','limit_reached',
    'subscription_expiring','audio_received'
  ) THEN
    RETURN FALSE;
  END IF;

  IF LENGTH(p_message) > 500 THEN
    RETURN FALSE;
  END IF;

  -- Rate Limiting
  SELECT MAX(created_at) INTO v_last_notification
  FROM notifications
  WHERE tenant_id = p_tenant_id
    AND type = p_type
    AND created_at > NOW() - 
      (v_cooldown_hours || ' hours')::INTERVAL;

  IF v_last_notification IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  -- إشعار للـ Admin
  INSERT INTO notifications (
    tenant_id, agency_id, target_role,
    type, channel, message, is_read, email_sent
  ) VALUES (
    p_tenant_id, p_agency_id, 'admin',
    p_type, 'both', p_message, FALSE, FALSE
  );

  -- إشعار للـ Super Admin لو في وكالة
  IF p_agency_id IS NOT NULL THEN
    INSERT INTO notifications (
      tenant_id, agency_id, target_role,
      type, channel, message, is_read, email_sent
    ) VALUES (
      p_tenant_id, p_agency_id, 'super_admin',
      p_type, 'in_app', p_message, FALSE, FALSE
    );
  END IF;

  -- إشعار للـ Master Admin دايماً
  INSERT INTO notifications (
    tenant_id, agency_id, target_role,
    type, channel, message, is_read, email_sent
  ) VALUES (
    p_tenant_id, p_agency_id, 'master_admin',
    p_type, 'in_app', p_message, FALSE, FALSE
  );

  RETURN TRUE;

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'send_usage_notification error: %', 
    SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
