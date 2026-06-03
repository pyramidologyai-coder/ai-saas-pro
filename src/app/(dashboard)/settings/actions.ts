'use server';

import { createClient } from '@supabase/supabase-js';
import { TenantCrypto } from '@/lib/crypto';
import { AgencyRateLimiter } from '@/lib/rate-limiter';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * 2126 Cyber Security: Server-side Settings Update
 * We MUST use the server to update settings so we can securely encrypt sensitive tokens (meta_token)
 * before they reach the database.
 */
export async function saveTenantSettingsAction(token: string, tenantId: string, formData: any) {
    // 1. Verify User
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
        throw new Error('Unauthorized');
    }

    // 2. Validate Object-Level Authorization (BOLA Defense)
    // Ensure the user actually owns this tenant before updating it.
    const { data: tenantAccess } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', tenantId)
        .eq('user_id', user.id)
        .single();
        
    if (!tenantAccess) {
        // Fallback: check if user is agency owner of this tenant
        const { data: agencyAccess } = await supabase
            .from('tenants')
            .select('id, agency:agencies!inner(user_id)')
            .eq('id', tenantId)
            .eq('agencies.user_id', user.id)
            .single();

        if (!agencyAccess) {
            console.warn(`[BOLA ALERT] User ${user.id} attempted to modify settings for Tenant ${tenantId} without authorization.`);
            throw new Error('Security Violation: You do not own this tenant (BOLA Blocked).');
        }

        // Apply Agency-Level Rate Limiting
        const agencyId = (agencyAccess as any).agency?.user_id || (Array.isArray((agencyAccess as any).agency) ? (agencyAccess as any).agency[0]?.user_id : 'unknown');
        if (!AgencyRateLimiter.check(agencyId, 30, 60000)) {
            throw new Error('Security Violation: Rate Limit Exceeded. Too many requests.');
        }
    } else {
        // If it's a direct user (not via agency), limit by user ID
        if (!AgencyRateLimiter.check(user.id, 30, 60000)) {
            throw new Error('Security Violation: Rate Limit Exceeded. Too many requests.');
        }
    }

    // 3. Encrypt Sensitive Data & PREVENT MASS ASSIGNMENT (Privilege Escalation Defense)
    // Only allow specific non-sensitive fields to be updated. Block 'subscription_tier', 'status', etc.
    const allowedFields = ['whatsapp_number_id', 'zapier_webhook', 'theme_color', 'custom_domain', 'language', 'api_key'];
    const safeData: any = {};
    
    for (const field of allowedFields) {
        if (formData[field] !== undefined) {
            safeData[field] = formData[field];
        }
    }

    if (formData.api_key && formData.api_key.trim() !== '') {
        const crypto = require('crypto');
        safeData.api_key = formData.api_key;
        safeData.api_key_hash = crypto.createHash('sha256').update(formData.api_key).digest('hex');
    } else if (formData.api_key === '') {
        // Explicit clear
        safeData.api_key = '';
        safeData.api_key_hash = null;
    }

    if (formData.meta_token) {
        safeData.meta_token = formData.meta_token;
    }
    
    if (safeData.meta_token && !safeData.meta_token.includes(':')) {
        // Only encrypt if it's not already encrypted (doesn't have the iv:authTag format)
        safeData.meta_token = await TenantCrypto.encrypt(safeData.meta_token, tenantId);
    }
    
    // 4. Save to Database using Admin Client (since we verified BOLA manually)
    const supabaseAdmin = getSupabaseAdminClient();
    
    const { error } = await supabaseAdmin.from('tenants').update(safeData).eq('id', tenantId);
    
    if (error) {
        console.error('Settings Save Error:', error);
        throw new Error('Failed to save settings.');
    }
    
    // 5. Audit Logging
    await supabaseAdmin.from('audit_logs').insert([{
        actor_id: user.id,
        action_type: 'UPDATE_TENANT_SETTINGS',
        entity_id: tenantId,
        new_data: { timestamp: new Date().toISOString() } // Avoid logging sensitive safeData entirely
    }]);

    return { success: true };
}
