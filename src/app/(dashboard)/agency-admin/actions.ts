'use server';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { TenantCrypto } from '@/lib/crypto';

/**
 * 2126 Cyber Security: Secure Settings Saving for Agencies
 * Encrypts sensitive keys on the server before writing to the database.
 * Integrates robust BOLA (Broken Object Level Authorization) checks.
 */
export async function saveAgencySettingsAction(
  agencyId: string,
  customDomain: string,
  stripeAccountId: string,
  paymobApiKey: string
) {
  // 1. Verify User Authentication
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // 2. Validate BOLA: Ensure this user actually owns this agency
  const { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .select('id, user_id')
    .eq('id', agencyId)
    .eq('user_id', user.id)
    .single();

  if (agencyError || !agency) {
    console.warn(`[BOLA ALERT] User ${user.id} attempted to modify settings for Agency ${agencyId} without authorization.`);
    throw new Error('Security Violation: You do not own this agency (BOLA Blocked).');
  }

  // 3. Prepare sanitized and secure update payload
  const updateData: any = {
    custom_domain: customDomain ? customDomain.trim() : ''
  };

  // Only update stripe_account_id if it has been modified (i.e. is not the masked placeholder)
  if (stripeAccountId && !stripeAccountId.includes('••••')) {
    updateData.stripe_account_id = stripeAccountId.trim();
  } else if (stripeAccountId === '') {
    updateData.stripe_account_id = '';
  }

  // Only encrypt and update paymob_api_key if it has been modified
  if (paymobApiKey && !paymobApiKey.includes('••••')) {
    updateData.paymob_api_key_encrypted = await TenantCrypto.encrypt(paymobApiKey.trim(), agencyId);
  } else if (paymobApiKey === '') {
    updateData.paymob_api_key_encrypted = '';
  }

  // 4. Save to Database using the Admin Client
  const supabaseUrlSanitized = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/[^\x20-\x7E]/g, '').trim();
  const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[^\x20-\x7E]/g, '').trim();
  const supabaseAdmin = createSupabaseClient(supabaseUrlSanitized, supabaseServiceKey);

  const { error: updateError } = await supabaseAdmin
    .from('agencies')
    .update(updateData)
    .eq('id', agencyId);

  if (updateError) {
    console.error('Agency settings update failed:', updateError.message);
    throw new Error('Failed to save settings.');
  }

  // 5. Log Security Audit
  await supabaseAdmin.from('audit_logs').insert([{
    actor_id: user.id,
    action_type: 'UPDATE_AGENCY_SETTINGS',
    entity_id: agencyId,
    changes: { timestamp: new Date().toISOString() } // Never log sensitive details
  }]);

  return { success: true };
}

/**
 * 2126 Cyber Security: Secure Clinic Status Toggle (Active/Suspended)
 * Performs strict BOLA validation on the server side to protect clinic tenants.
 */
export async function toggleTenantStatusAction(
  tenantId: string,
  agencyId: string,
  currentStatus: string
) {
  // 1. Verify User Authentication
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // 2. Validate BOLA: Ensure this user owns the parent Agency
  const { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .select('id')
    .eq('id', agencyId)
    .eq('user_id', user.id)
    .single();

  if (agencyError || !agency) {
    throw new Error('Security Violation: You do not own this agency (BOLA Blocked).');
  }

  // 3. Validate Tenant belongs to this agency
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, agency_id')
    .eq('id', tenantId)
    .eq('agency_id', agencyId)
    .single();

  if (tenantError || !tenant) {
    throw new Error('Security Violation: Tenant does not belong to your agency (BOLA Blocked).');
  }

  const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';

  // 4. Update Status using Admin Client
  const supabaseUrlSanitized = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/[^\x20-\x7E]/g, '').trim();
  const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[^\x20-\x7E]/g, '').trim();
  const supabaseAdmin = createSupabaseClient(supabaseUrlSanitized, supabaseServiceKey);

  const { error: updateError } = await supabaseAdmin
    .from('tenants')
    .update({ status: newStatus })
    .eq('id', tenantId)
    .eq('agency_id', agencyId);

  if (updateError) {
    console.error('Tenant status update failed:', updateError.message);
    throw new Error('Failed to update tenant status.');
  }

  // 5. Log Security Audit
  await supabaseAdmin.from('audit_logs').insert([{
    actor_id: user.id,
    action_type: 'TOGGLE_TENANT_STATUS',
    entity_id: tenantId,
    changes: { new_status: newStatus, timestamp: new Date().toISOString() }
  }]);

  return { success: true, newStatus };
}

/**
 * 2126 Cyber Security: Server-side Reseller (Agency) Registration Request
 * Safe insertion of pending-payment agency status.
 */
export async function requestAgencyUpgradeAction() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Check if user already has an agency registration
  const { data: existing } = await supabase
    .from('agencies')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (existing) {
    throw new Error('لديك طلب وكالة مسجل بالفعل.');
  }

  const { error } = await supabase.from('agencies').insert({
    user_id: user.id,
    name: 'وكالتي الإعلانية',
    subscription_status: 'pending_payment'
  });

  if (error) {
    console.error('Failed to create pending agency:', error.message);
    throw new Error('حدث خطأ أثناء تسجيل طلب الوكالة.');
  }

  return { success: true };
}
