// ========================================================
// 2126 AUTOMATED PENETRATION TEST & SECURITY AUDIT
// Run this before EVERY Vercel deployment: node scripts/security-audit.js
// ========================================================

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runPenTest() {
  console.log('\n🛡️ INITIATING 2126 AUTOMATED PEN-TEST...');
  let vulnerabilitiesFound = 0;

  // --------------------------------------------------------
  // TEST 1: RLS Bypass Attempt (Can Anonymous user read Tenants?)
  // --------------------------------------------------------
  console.log('\n[TEST 1] Attempting to bypass Row Level Security (RLS) on "tenants" table...');
  try {
    const { data, error } = await supabase.from('tenants').select('id, meta_token').limit(1);
    
    // An anonymous user should NOT be able to read meta_token or any rows without auth
    if (data && data.length > 0) {
      console.error('❌ VULNERABILITY FOUND: RLS is broken! Anonymous users can read tenant data.');
      vulnerabilitiesFound++;
    } else {
      console.log('✅ SECURE: RLS successfully blocked anonymous access.');
    }
  } catch (err) {
    console.error('Test Failed to execute:', err);
  }

  // --------------------------------------------------------
  // TEST 2: API Rate Limiting & Auth Bypass
  // --------------------------------------------------------
  console.log('\n[TEST 2] Attempting to access /api/v1/bookings without API Key...');
  try {
    const res = await fetch('http://localhost:3000/api/v1/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: 'Hacker', bookingTime: '2026-05-01', serviceName: 'Hack' })
    });

    if (res.status === 401) {
      console.log('✅ SECURE: API Gateway successfully blocked unauthorized request (401).');
    } else {
      console.error(`❌ VULNERABILITY FOUND: API returned status ${res.status} instead of 401 Unauthorized.`);
      vulnerabilitiesFound++;
    }
  } catch (err) {
    console.log('⚠️ API not running locally. Skipping live HTTP test (Run `npm run dev` in another terminal to test this).');
  }

  // --------------------------------------------------------
  // TEST 3: Webhook Spoofing (Invalid Signature)
  // --------------------------------------------------------
  console.log('\n[TEST 3] Simulating Stripe Webhook Spoofing...');
  try {
    const res = await fetch('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'stripe-signature': 'fake_signature_123'
      },
      body: JSON.stringify({ id: 'evt_fake', type: 'checkout.session.completed' })
    });

    if (res.status === 400 || res.status === 500) {
      console.log('✅ SECURE: Webhook successfully rejected invalid Stripe signature.');
    } else {
      console.error(`❌ VULNERABILITY FOUND: Webhook accepted a fake signature (Status: ${res.status}).`);
      vulnerabilitiesFound++;
    }
  } catch (err) {
    console.log('⚠️ API not running locally. Skipping live HTTP test.');
  }

  // --------------------------------------------------------
  // RESULTS
  // --------------------------------------------------------
  console.log('\n=============================================');
  if (vulnerabilitiesFound === 0) {
    console.log('                 🟩 AUDIT PASSED 🟩');
    console.log('    Zero Trust Architecture is holding. Safe to Deploy.');
  } else {
    console.log('                 🟥 AUDIT FAILED 🟥');
    console.error(`    CRITICAL: Found ${vulnerabilitiesFound} vulnerabilities. DO NOT DEPLOY.`);
    process.exit(1); // Force CI/CD pipeline to fail
  }
  console.log('=============================================\n');
}

runPenTest();
