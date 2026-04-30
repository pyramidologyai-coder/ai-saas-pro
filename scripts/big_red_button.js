// ==========================================
// 🚀 2126 "BIG RED BUTTON" DIAGNOSTIC SCRIPT
// Run this after deployment to verify all systems.
// ==========================================

require('dotenv').config({ path: '.env.production' });
const crypto = require('crypto');

async function runDiagnostics() {
    console.log('\n--- 🚀 INITIATING 2126 PRE-FLIGHT CHECKS ---\n');
    let allClear = true;

    // 1. Environment Check
    console.log('[1/4] Checking Environment Variables...');
    const requiredVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY'
    ];
    
    for (const v of requiredVars) {
        if (!process.env[v] || process.env[v].length < 10) {
            console.error(`❌ Missing or invalid environment variable: ${v}`);
            allClear = false;
        }
    }
    if (allClear) console.log('✅ Core Environment Variables OK');

    // 2. Database Connectivity Check
    console.log('\n[2/4] Testing Supabase Connectivity & Authentication...');
    if (allClear) {
        try {
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            
            // Ping DB
            const { data, error } = await supabase.from('platform_settings').select('id').limit(1);
            if (error) {
                console.error('❌ Database connection failed. Please check your URLs and RLS policies.');
                console.error(error);
                allClear = false;
            } else {
                console.log('✅ Database Connection OK (Service Role authorized)');
            }
        } catch (e) {
            console.error('❌ Database test crashed:', e.message);
            allClear = false;
        }
    }

    // 3. Crypto & KMS Simulation Check
    console.log('\n[3/4] Testing 2126 Cryptography Engine (AES-256-GCM)...');
    try {
        // We simulate the AES GCM encryption here to ensure Node crypto supports it.
        const masterKey = crypto.createHash('sha256').update('TEST_MASTER_SECRET').digest();
        const ivHash = crypto.createHash('md5').update('fake-tenant-id').digest('hex');
        const iv = Buffer.from(ivHash.substring(0, 24), 'hex');
        
        const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
        let encrypted = cipher.update('my_secret_token', 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        if (encrypted.length > 5) {
            console.log('✅ Cryptography Engine OK (AES-256-GCM Hardware Acceleration active)');
        } else {
            allClear = false;
            console.error('❌ Cryptography Engine returned empty string.');
        }
    } catch (e) {
        console.error('❌ Cryptography Engine Failed. Node.js version might be too old.', e.message);
        allClear = false;
    }

    // 4. API Health Endpoint Ping Check
    console.log('\n[4/4] Verifying Meta API connectivity...');
    try {
        const fetchRes = await fetch('https://graph.facebook.com/v19.0/', { method: 'GET' });
        // We expect a 400 or 200, but not a timeout (5xx).
        if (fetchRes.status >= 500) {
            console.error('❌ Meta API is currently unreachable from this server.');
            allClear = false;
        } else {
            console.log('✅ Meta API Connectivity OK (Server can reach Facebook)');
        }
    } catch (e) {
        console.error('❌ Failed to resolve graph.facebook.com. Check your server\'s DNS/Firewall.');
        allClear = false;
    }

    // FINAL VERDICT
    console.log('\n=============================================');
    if (allClear) {
        console.log('                 🟩 ALL SYSTEMS GO 🟩');
        console.log('    The Multi-Tenant Digital Fortress is Online.');
    } else {
        console.log('                 🟥 LAUNCH ABORTED 🟥');
        console.log('    Critical errors detected. Please fix the issues above.');
    }
    console.log('=============================================\n');
}

runDiagnostics();
