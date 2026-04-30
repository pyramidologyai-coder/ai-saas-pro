-- ========================================================
-- FINANCIAL LEDGER (Double-Entry Bookkeeping System)
-- ========================================================
-- This table replaces simple "balance" columns with an immutable 
-- cryptographic ledger. Every financial event MUST have a Credit or Debit.
-- The balance is dynamically verified.

CREATE TABLE wallet_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Transaction Categorization
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('subscription_fee', 'ai_usage_fee', 'payout', 'refund', 'deposit')),
    
    -- Double Entry Core
    credit DECIMAL(12, 2) NOT NULL DEFAULT 0.00, -- Money added to the wallet
    debit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,  -- Money deducted from the wallet
    
    -- Verification
    description TEXT NOT NULL,
    reference_id VARCHAR(255), -- E.g., Stripe Payment Intent ID or Booking ID
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Integrity Constraint: A transaction must be exclusively a credit OR a debit (not both, not neither)
    CONSTRAINT check_single_entry CHECK (
        (credit > 0 AND debit = 0) OR 
        (debit > 0 AND credit = 0)
    )
);

-- Protect the Ledger: NO UPDATES, NO DELETES allowed (WORM Protocol)
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY read_own_ledger ON wallet_ledger 
FOR SELECT USING (
    agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid()) OR
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
);

-- Prevent any manual insertions from the browser (Zero-Trust)
-- Only Vercel Backend (Service Role) can insert financial records.
CREATE POLICY no_client_inserts ON wallet_ledger FOR INSERT WITH CHECK (false);
CREATE POLICY no_client_updates ON wallet_ledger FOR UPDATE USING (false);
CREATE POLICY no_client_deletes ON wallet_ledger FOR DELETE USING (false);

-- Trigger to calculate the dynamic running balance (Optional if calculating via View, but View is safer)
CREATE OR REPLACE VIEW wallet_balances AS
SELECT 
    agency_id,
    tenant_id,
    SUM(credit) - SUM(debit) as current_balance
FROM wallet_ledger
GROUP BY agency_id, tenant_id;
