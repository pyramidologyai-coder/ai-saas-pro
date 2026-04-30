-- ========================================================
-- WALLET DEDUCTION RPC (Race Condition Proof)
-- ========================================================
-- This function safely charges an agency or tenant wallet.
-- It locks the ledger for the specific wallet, calculates the current balance,
-- checks if there are enough funds, and inserts the debit entry.

CREATE OR REPLACE FUNCTION charge_wallet(
    p_agency_id UUID,
    p_tenant_id UUID,
    p_amount DECIMAL,
    p_description TEXT,
    p_transaction_type VARCHAR
)
RETURNS JSON AS $$
DECLARE
    current_balance DECIMAL := 0.00;
    v_new_id UUID;
BEGIN
    -- 1. Apply Row-Level Locking (Pessimistic Locking)
    -- We lock the related rows in the tenants or agencies table to serialize concurrent requests.
    -- This prevents two simultaneous requests from reading the same balance before deduction.
    IF p_tenant_id IS NOT NULL THEN
        PERFORM id FROM tenants WHERE id = p_tenant_id FOR UPDATE;
    ELSIF p_agency_id IS NOT NULL THEN
        PERFORM id FROM agencies WHERE id = p_agency_id FOR UPDATE;
    ELSE
        RAISE EXCEPTION 'Must provide either agency_id or tenant_id';
    END IF;

    -- 2. Calculate Current Balance from the Ledger
    SELECT COALESCE(SUM(credit) - SUM(debit), 0.00)
    INTO current_balance
    FROM wallet_ledger
    WHERE (agency_id = p_agency_id OR (agency_id IS NULL AND p_agency_id IS NULL))
      AND (tenant_id = p_tenant_id OR (tenant_id IS NULL AND p_tenant_id IS NULL));

    -- 3. Verify Sufficient Funds (No Negative Balance allowed for usage)
    IF current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient Funds. Current balance: %', current_balance;
    END IF;

    -- 4. Insert the Debit Transaction (Append-only Ledger)
    INSERT INTO wallet_ledger (
        agency_id, tenant_id, transaction_type, debit, credit, description
    ) VALUES (
        p_agency_id, p_tenant_id, p_transaction_type, p_amount, 0.00, p_description
    ) RETURNING id INTO v_new_id;

    -- 5. Return success and the new balance
    RETURN json_build_object(
        'status', 'success',
        'transaction_id', v_new_id,
        'new_balance', current_balance - p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Notice: SECURITY DEFINER allows the function to bypass RLS when called by the server, 
-- ensuring the server can process payments even if the user's token isn't fully privileged.
-- However, we only expose this RPC to the 'service_role' (Backend).

-- Revoke access from anonymous and authenticated users (Zero-Trust)
REVOKE EXECUTE ON FUNCTION charge_wallet(UUID, UUID, DECIMAL, TEXT, VARCHAR) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION charge_wallet(UUID, UUID, DECIMAL, TEXT, VARCHAR) FROM anon;
REVOKE EXECUTE ON FUNCTION charge_wallet(UUID, UUID, DECIMAL, TEXT, VARCHAR) FROM authenticated;
GRANT EXECUTE ON FUNCTION charge_wallet(UUID, UUID, DECIMAL, TEXT, VARCHAR) TO service_role;
