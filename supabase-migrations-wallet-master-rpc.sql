-- ========================================================
-- MASTER ADMIN WALLET MANAGEMENT RPCS
-- ========================================================

-- 1. get_wallet_summary() RPC
CREATE OR REPLACE FUNCTION get_wallet_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_credited DECIMAL(12, 2) := 0.00;
  v_total_debited DECIMAL(12, 2) := 0.00;
  v_current_balance DECIMAL(12, 2) := 0.00;
  v_agencies_count BIGINT := 0;
BEGIN
  -- Security check
  IF NOT is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Sum values from the double-entry ledger
  SELECT 
    COALESCE(SUM(credit), 0.00), 
    COALESCE(SUM(debit), 0.00)
  INTO v_total_credited, v_total_debited
  FROM wallet_ledger;

  v_current_balance := v_total_credited - v_total_debited;

  -- Count total agencies
  SELECT COUNT(*) INTO v_agencies_count FROM agencies;

  RETURN jsonb_build_object(
    'total_credited', v_total_credited,
    'total_debited', v_total_debited,
    'current_balance', v_current_balance,
    'agencies_count', v_agencies_count
  );
END;
$$;

-- 2. get_wallet_transactions() RPC
CREATE OR REPLACE FUNCTION get_wallet_transactions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Security check
  IF NOT is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_result
  FROM (
    SELECT 
      w.id,
      w.agency_id,
      w.tenant_id,
      a.name as agency_name,
      w.transaction_type,
      w.credit,
      w.debit,
      w.description,
      w.reference_id,
      w.created_at
    FROM wallet_ledger w
    LEFT JOIN agencies a ON w.agency_id = a.id
    ORDER BY w.created_at DESC
  ) t;

  RETURN v_result;
END;
$$;

-- 3. add_wallet_credit() RPC
CREATE OR REPLACE FUNCTION add_wallet_credit(
    p_agency_id UUID,
    p_amount DECIMAL,
    p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  -- Security check
  IF NOT is_master_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Verify target agency exists
  IF NOT EXISTS (SELECT 1 FROM agencies WHERE id = p_agency_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agency not found');
  END IF;

  -- Insert manual credit record into double-entry WORM ledger
  INSERT INTO wallet_ledger (
    agency_id,
    transaction_type,
    credit,
    debit,
    description,
    reference_id
  ) VALUES (
    p_agency_id,
    'deposit',
    p_amount,
    0.00,
    COALESCE(p_description, 'Master Admin manual credit'),
    'manual_credit_' || EXTRACT(EPOCH FROM NOW())::TEXT
  ) RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'transaction_id', v_new_id);
END;
$$;
