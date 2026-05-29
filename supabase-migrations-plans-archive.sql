-- 1. إضافة عمود الأرشفة لجدول الباقات
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

-- 2. دالة أرشفة الباقة مع تسجيل السجلات
CREATE OR REPLACE FUNCTION archive_plan(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_name text;
  v_plan_slug text;
  v_agencies_count bigint;
  v_tenants_count bigint;
BEGIN
  IF NOT is_master_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT name, slug INTO v_plan_name, v_plan_slug 
  FROM plans WHERE id = p_plan_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan not found');
  END IF;

  SELECT COUNT(*) INTO v_agencies_count 
  FROM agencies WHERE plan_type = v_plan_slug;
  
  SELECT COUNT(*) INTO v_tenants_count
  FROM tenants WHERE plan_type = v_plan_slug;

  UPDATE plans 
  SET 
    is_active = false,
    archived_at = now(),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = p_plan_id;

  INSERT INTO audit_logs (action_type, entity_type, entity_id, actor_id, changes)
  VALUES (
    'plan_archived', 'plan', p_plan_id::text, auth.uid(),
    jsonb_build_object(
      'name', v_plan_name,
      'slug', v_plan_slug,
      'agencies_affected', v_agencies_count,
      'tenants_affected', v_tenants_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'agencies_on_plan', v_agencies_count,
    'tenants_on_plan', v_tenants_count,
    'message', 'Plan archived - existing subscribers unaffected'
  );
END;
$$;

-- 3. دالة فحص استخدام الباقة قبل الأرشفة
CREATE OR REPLACE FUNCTION get_plan_usage(p_plan_slug text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agencies jsonb;
  v_tenants jsonb;
BEGIN
  IF NOT is_master_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'status', subscription_status
  )), '[]'::jsonb) INTO v_agencies
  FROM agencies WHERE plan_type = p_plan_slug;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'status', status
  )), '[]'::jsonb) INTO v_tenants
  FROM tenants WHERE plan_type = p_plan_slug;

  RETURN jsonb_build_object(
    'agencies', v_agencies,
    'agencies_count', jsonb_array_length(v_agencies),
    'tenants', v_tenants,
    'tenants_count', jsonb_array_length(v_tenants)
  );
END;
$$;

-- 4. منح صلاحيات الاستدعاء للـ Authenticated Users
GRANT EXECUTE ON FUNCTION archive_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_plan_usage(text) TO authenticated;

-- 5. تحديث سياسة SELECT على جدول الباقات لعدم إظهار المؤرشف للوكالات
DROP POLICY IF EXISTS "all_read_plans" ON public.plans;
CREATE POLICY "all_read_plans" ON public.plans 
FOR SELECT 
USING (archived_at IS NULL OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'master_admin');
