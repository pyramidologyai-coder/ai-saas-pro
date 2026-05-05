'use server';

import { createClient } from '@supabase/supabase-js';

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

/**
 * 10000-YEAR HACKER DEFENSE: Server-Side ONLY Admin Client
 * Validates the user's token securely on the server before granting any Service Role access.
 */
const getAdminClient = async (token: string) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
        throw new Error('Missing required Supabase environment variables.');
    }

    if (SUPER_ADMIN_EMAILS.length === 0) {
        throw new Error('SUPER_ADMIN_EMAILS environment variable is not configured.');
    }

    // 1. Verify user token using anon key (no elevated privileges)
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user || !SUPER_ADMIN_EMAILS.includes(user.email || '')) {
        throw new Error('Security Violation: Unauthorized Super Admin Access');
    }

    // 2. Return Service Role Client (server-side only, never sent to browser)
    return createClient(supabaseUrl, serviceRoleKey);
};

export async function fetchSuperAdminData(token: string) {
    try {
        const supabaseAdmin = await getAdminClient(token);

        const { data: adminTenantsData } = await supabaseAdmin.from('tenants').select('*, agency:agencies(*)');
        const { data: agenciesData } = await supabaseAdmin.from('agencies').select('*');
        const { data: messagesData } = await supabaseAdmin.from('messages').select('tenant_id, sender');
        const { data: platformSettings } = await supabaseAdmin.from('platform_settings').select('*').limit(1).single();

        return { 
            success: true, 
            adminTenantsData, 
            agenciesData, 
            messagesData, 
            platformSettings 
        };
    } catch (error: any) {
        console.error('Super Admin Fetch Error:', error.message);
        return { success: false, error: error.message };
    }
}

export async function toggleTenantStatusAction(token: string, tenantId: string, currentStatus: string, userId: string) {
    const supabaseAdmin = await getAdminClient(token);
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    
    await supabaseAdmin.from('tenants').update({ status: newStatus }).eq('id', tenantId);
    
    // Stealth Audit Logging
    await supabaseAdmin.from('audit_logs').insert([{
        actor_id: userId,
        action_type: 'MASTER_ADMIN_TOGGLE_TENANT',
        entity_id: tenantId,
        new_data: { status: newStatus }
    }]);

    return newStatus;
}

export async function saveAgencyPricingAction(token: string, baseFee: number, percentage: number) {
    const supabaseAdmin = await getAdminClient(token);
    const { data: currentSettings } = await supabaseAdmin.from('platform_settings').select('id').limit(1).single();
    
    if (currentSettings) {
        await supabaseAdmin.from('platform_settings')
          .update({ agency_base_fee: baseFee, agency_percentage: percentage })
          .eq('id', currentSettings.id);
    } else {
        await supabaseAdmin.from('platform_settings')
          .insert([{ agency_base_fee: baseFee, agency_percentage: percentage }]);
    }
    return { success: true };
}

export async function savePlanAction(token: string, plan: any, userId: string) {
    const supabaseAdmin = await getAdminClient(token);
    
    // Fetch old values for audit
    const { data: oldPlan } = await supabaseAdmin.from('plans').select('*').eq('id', plan.id).single();

    const payload = {
        price_monthly: parseFloat(plan.price_monthly),
        price_yearly: parseFloat(plan.price_yearly),
        messages_limit: parseInt(plan.messages_limit),
        voice_minutes_limit: parseFloat(plan.voice_minutes_limit),
        reminder_credits: parseInt(plan.reminder_credits),
        extra_500_price: parseFloat(plan.extra_500_price || 0),
        extra_1000_price: parseFloat(plan.extra_1000_price || 0),
        extra_5000_price: parseFloat(plan.extra_5000_price || 0),
        updated_at: new Date().toISOString(),
        updated_by: userId
    };

    const { error } = await supabaseAdmin.from('plans').update(payload).eq('id', plan.id);
    if (error) throw new Error('Database error: ' + error.message);

    // Stealth Audit Logging
    await supabaseAdmin.from('audit_logs').insert([{
        actor_id: userId,
        action_type: 'plan_updated',
        entity_id: plan.id,
        new_data: { plan_slug: plan.slug, old_values: oldPlan, new_values: payload }
    }]);

    return { success: true };
}
