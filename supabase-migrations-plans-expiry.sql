-- Migration: Update add_plan and create_agency with expires_at validation and intended_for logic

-- 1. Ensure columns exist on plans table
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL;

-- 2. Update add_plan RPC
CREATE OR REPLACE FUNCTION public.add_plan(
  p_name text,
  p_slug text,
  p_price_monthly numeric,
  p_price_yearly numeric,
  p_messages_limit integer,
  p_voice_minutes_limit numeric,
  p_commission_rate numeric,
  p_intended_for text DEFAULT 'both'::text,
  p_reminder_enabled boolean DEFAULT false,
  p_voice_reminder_enabled boolean DEFAULT false,
  p_reminder_credits integer DEFAULT 0,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_clean_slug text;
  v_new_plan_id uuid;
BEGIN
  IF NOT is_master_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  v_clean_slug := LOWER(REGEXP_REPLACE(TRIM(p_slug), '\s+', '-', 'g'));

  IF TRIM(p_name) = '' OR v_clean_slug = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Name and Slug cannot be empty');
  END IF;

  IF p_price_monthly < 0 OR p_price_yearly < 0 
     OR p_commission_rate < 0 OR p_commission_rate > 100
     OR p_messages_limit < 0 OR p_voice_minutes_limit < 0
     OR p_reminder_credits < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid numerical values');
  END IF;

  IF p_intended_for NOT IN ('agency', 'business', 'both') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid intended_for value');
  END IF;

  -- تأكد إن تاريخ الانتهاء في المستقبل
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expiry date must be in the future');
  END IF;

  IF EXISTS (SELECT 1 FROM plans WHERE slug = v_clean_slug) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slug already exists');
  END IF;

  INSERT INTO plans (
    name, slug, price_monthly, price_yearly,
    messages_limit, voice_minutes_limit,
    commission_rate, intended_for,
    reminder_enabled, voice_reminder_enabled,
    reminder_credits, is_active, expires_at,
    updated_by, updated_at
  ) VALUES (
    TRIM(p_name), v_clean_slug, p_price_monthly, p_price_yearly,
    p_messages_limit, p_voice_minutes_limit,
    p_commission_rate, p_intended_for,
    p_reminder_enabled, p_voice_reminder_enabled,
    p_reminder_credits, true, p_expires_at,
    auth.uid(), now()
  )
  RETURNING id INTO v_new_plan_id;

  INSERT INTO audit_logs (action_type, entity_type, entity_id, actor_id, changes)
  VALUES (
    'plan_created', 'plan', v_new_plan_id::text, auth.uid(),
    jsonb_build_object(
      'name', TRIM(p_name),
      'slug', v_clean_slug,
      'price', p_price_monthly,
      'intended_for', p_intended_for,
      'expires_at', p_expires_at
    )
  );

  RETURN jsonb_build_object('success', true, 'plan_id', v_new_plan_id);
END;
$function$;

-- 3. Update create_agency RPC
CREATE OR REPLACE FUNCTION public.create_agency(
  p_name text,
  p_contact_email text,
  p_whatsapp_number text,
  p_commission_rate numeric,
  p_plan_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agency_id uuid;
BEGIN
  IF NOT is_master_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF TRIM(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Name required');
  END IF;

  IF p_contact_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email');
  END IF;

  IF p_commission_rate < 0 OR p_commission_rate > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid commission rate');
  END IF;

  -- ✅ تأكد إن الباقة للوكالات + مش منتهية
  IF NOT EXISTS (
    SELECT 1 FROM plans 
    WHERE slug = p_plan_type 
    AND is_active = true
    AND intended_for IN ('agency', 'both')
    AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired plan for agency');
  END IF;

  INSERT INTO agencies (
    name, contact_email, whatsapp_number,
    commission_rate, plan_type,
    subscription_status, status
  ) VALUES (
    TRIM(p_name), LOWER(TRIM(p_contact_email)),
    TRIM(p_whatsapp_number), p_commission_rate,
    p_plan_type, 'active', 'active'
  )
  RETURNING id INTO v_agency_id;

  INSERT INTO audit_logs (action_type, entity_type, entity_id, actor_id, changes)
  VALUES (
    'agency_created', 'agency', v_agency_id::text, auth.uid(),
    jsonb_build_object(
      'name', TRIM(p_name),
      'email', LOWER(TRIM(p_contact_email)),
      'plan', p_plan_type,
      'commission_rate', p_commission_rate
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'agency_id', v_agency_id,
    'email', LOWER(TRIM(p_contact_email))
  );
END;
$function$;

-- 4. Grant execution privileges to authenticated users
GRANT EXECUTE ON FUNCTION public.add_plan(text, text, numeric, numeric, integer, numeric, numeric, text, boolean, boolean, integer, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_agency(text, text, text, numeric, text) TO authenticated;
