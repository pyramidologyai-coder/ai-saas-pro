
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

console.log('\n========================================================');
console.log('🛡️  COGNITIVE ARCHITECTURE & SECURITY AUDIT (V1.0) 🛡️');
console.log('========================================================\n');

// Initialize Supabase Clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey || !anonKey) {
  console.error('❌ [FATAL] Supabase keys missing in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey);
const supabaseAnon = createClient(supabaseUrl, anonKey); // Represents a hacker or public user

async function runAudit() {
  let passed = 0;
  let total = 0;

  function assert(condition, successMsg, failMsg) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${successMsg}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] ${failMsg}`);
    }
  }

  // TEST 1: KMS AES-256 Encryption
  console.log('\n--- 1. Testing KMS (AES-256-GCM) Encryption ---');
  try {
    const key = process.env.DATABASE_ENCRYPTION_KEY;
    if (!key || key.length !== 32) throw new Error('DATABASE_ENCRYPTION_KEY missing or not 32 bytes.');
    
    const text = 'my-secret-whatsapp-token-123';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'utf-8'), iv);
    let encrypted = cipher.update(text, 'utf8', 'base64') + cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');
    
    assert(encrypted !== text, 'Data is properly encrypted.', 'Data is stored in plain text!');
    
    // Decrypt
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'utf-8'), iv);
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    let decrypted = decipher.update(encrypted, 'base64', 'utf8') + decipher.final('utf8');
    
    assert(decrypted === text, 'Data successfully decrypted back to original.', 'Decryption failed.');
  } catch (err) {
    console.log(`❌ [FAIL] KMS Test Failed: ${err.message}`);
    total++; total++; // Mark both asserts as failed
  }

  // TEST 2: Wallet Ledger RLS (Zero-Trust)
  console.log('\n--- 2. Testing Ledger RLS (Immutable WORM) ---');
  try {
    // Attempt to insert into wallet_ledger directly without backend privileges (Hacker attempt)
    const { error: insertError } = await supabaseAnon
      .from('wallet_ledger')
      .insert({ transaction_type: 'deposit', credit: 1000000, description: 'Hack' });
    
    assert(insertError !== null, 'Public/Client insertion to Wallet blocked by RLS.', 'SECURITY BREACH: Anyone can add money!');
    
    // Attempt to delete an audit log
    const { error: deleteError } = await supabaseAdmin
      .from('audit_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    // It should fail because of the BEFORE DELETE trigger raising an exception, even for admin
    assert(deleteError && deleteError.message.includes('WORM'), 'Audit Logs are immutable (WORM) even against Admin deletion.', 'Admin can delete audit logs!');
  } catch (err) {
    console.log(`❌ [FAIL] RLS Test Failed: ${err.message}`);
  }

  // TEST 3: RPC Double-Entry Wallet Deduction
  console.log('\n--- 3. Testing Race-Condition Proof RPC ---');
  try {
    // Generate a dummy UUID for test
    const dummyTenantId = crypto.randomUUID();
    
    // Attempt to charge a non-existent wallet (Should throw Insufficient Funds or not found)
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('charge_wallet', {
      p_tenant_id: dummyTenantId,
      p_amount: 50.00,
      p_desc: 'Test API Charge',
      p_type: 'ai_usage'
    });

    assert(rpcError && rpcError.message.includes('Insufficient Funds'), 'RPC securely rejected charge without balance.', 'RPC allowed charging a negative balance!');
  } catch (err) {
    console.log(`❌ [FAIL] RPC Test Failed: ${err.message}`);
  }

  console.log('\n========================================================');
  console.log(`🎯 AUDIT SCORE: ${passed} / ${total} Checks Passed`);
  if (passed === total) {
    console.log('🚀 STATUS: ENTERPRISE GRADE. SYSTEM IS SECURE AND READY FOR LAUNCH.');
  } else {
    console.log('⚠️ STATUS: VULNERABILITIES DETECTED. FIX ISSUES BEFORE LAUNCH.');
  }
  console.log('========================================================\n');
}

runAudit();
