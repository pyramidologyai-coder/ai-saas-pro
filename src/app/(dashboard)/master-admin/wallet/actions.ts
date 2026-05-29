'use server';

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

async function checkMasterRole(supabase: any, userId: string): Promise<boolean> {
  try {
    const [verifyRes, isMasterRes] = await Promise.allSettled([
      Promise.resolve(supabase.rpc('verify_master_admin_role')),
      Promise.resolve(supabase.rpc('is_master_admin'))
    ]);

    const verifyData = verifyRes.status === 'fulfilled' ? verifyRes.value.data : false;
    const fallbackData = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : false;

    return !!(verifyData || fallbackData);
  } catch {
    return false;
  }
}

/**
 * 2126 Cyber Security: Secure Manual Credit Addition by Master Admin
 * Recharges an agency's wallet balance using a double-entry debit/credit ledger event.
 * Fully verifies authorization and validates parameters.
 */
export async function addWalletCreditAction(
  agencyId: string,
  amount: number,
  description: string
) {
  // 1. Verify User Authentication
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient(
    { cookies: () => cookieStore as any },
    { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // 2. Validate Master Admin Role
  const isMaster = await checkMasterRole(supabase, user.id);
  if (!isMaster) {
    console.warn(`[SECURITY VIOLATION] Non-master user ${user.id} attempted to add wallet credit.`);
    throw new Error('Security Violation: Unauthorized Action.');
  }

  // 3. Input Parameter Validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!agencyId || !uuidRegex.test(agencyId)) {
    throw new Error('معرف الوكالة (Agency ID) غير صالح.');
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('قيمة الشحن يجب أن تكون أكبر من الصفر.');
  }

  const cleanDescription = description ? description.trim().substring(0, 500) : 'شحن يدوي بواسطة المدير العام';

  // 4. Update WORM double-entry ledger in database using Admin Client
  const supabaseUrlSanitized = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/[^\x20-\x7E]/g, '').trim();
  const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[^\x20-\x7E]/g, '').trim();
  const supabaseAdmin = createClient(supabaseUrlSanitized, supabaseServiceKey);

  // Try RPC first, fallback to direct insertion if missing
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('add_wallet_credit', {
    p_agency_id: agencyId,
    p_amount: amount,
    p_description: cleanDescription
  });

  if (rpcError && rpcError.code === 'PGRST202') {
    console.warn('add_wallet_credit RPC missing. Falling back to direct database insertion.');
    
    // Verify agency exists manually
    const { data: agencyExists } = await supabaseAdmin
      .from('agencies')
      .select('id')
      .eq('id', agencyId)
      .maybeSingle();

    if (!agencyExists) {
      throw new Error('الوكالة المطلوبة غير موجودة في النظام.');
    }

    const { error: insertError } = await supabaseAdmin
      .from('wallet_ledger')
      .insert([{
        agency_id: agencyId,
        transaction_type: 'deposit',
        credit: amount,
        debit: 0,
        description: cleanDescription,
        reference_id: `manual_credit_${Date.now()}`
      }]);

    if (insertError) {
      console.error('Manual credit ledger insert failed:', insertError.message);
      throw new Error('فشل تسجيل المعاملة في قواعد البيانات.');
    }
  } else if (rpcError) {
    console.error('add_wallet_credit RPC failed:', rpcError.message);
    throw new Error(rpcError.message || 'فشل شحن الرصيد.');
  }

  // 5. Insert security Audit Log
  await supabaseAdmin.from('audit_logs').insert([{
    actor_id: user.id,
    action_type: 'ADD_WALLET_CREDIT',
    entity_id: agencyId,
    changes: { amount, timestamp: new Date().toISOString() }
  }]);

  return { success: true };
}

/**
 * 2126 Cyber Security: Secure Manual Credit Addition for Direct Tenants (No Agency)
 * Recharges a direct clinic/restaurant tenant balance via double-entry WORM ledger event.
 */
export async function addTenantCreditAction(
  tenantId: string,
  amount: number,
  description: string
) {
  // 1. Verify User Authentication
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient(
    { cookies: () => cookieStore as any },
    { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // 2. Validate Master Admin Role
  const isMaster = await checkMasterRole(supabase, user.id);
  if (!isMaster) {
    throw new Error('Security Violation: Unauthorized Action.');
  }

  // 3. Input Parameter Validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!tenantId || !uuidRegex.test(tenantId)) {
    throw new Error('معرف العميل (Tenant ID) غير صالح.');
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('قيمة الشحن يجب أن تكون أكبر من الصفر.');
  }

  const cleanDescription = description ? description.trim().substring(0, 500) : 'شحن يدوي للعميل المباشر';

  // 4. Update ledger in database using Admin Client
  const supabaseUrlSanitized = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/[^\x20-\x7E]/g, '').trim();
  const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[^\x20-\x7E]/g, '').trim();
  const supabaseAdmin = createClient(supabaseUrlSanitized, supabaseServiceKey);

  // Verify direct tenant exists manually
  const { data: tenantExists } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .is('agency_id', null)
    .maybeSingle();

  if (!tenantExists) {
    throw new Error('العميل المباشر المطلوب غير موجود في النظام.');
  }

  // Insert manual credit record into double-entry WORM ledger
  const { error: insertError } = await supabaseAdmin
    .from('wallet_ledger')
    .insert([{
      tenant_id: tenantId,
      agency_id: null,
      transaction_type: 'deposit',
      credit: amount,
      debit: 0,
      description: cleanDescription,
      reference_id: `manual_credit_tenant_${Date.now()}`
    }]);

  if (insertError) {
    console.error('Manual credit tenant ledger insert failed:', insertError.message);
    throw new Error('فشل تسجيل المعاملة في قواعد البيانات.');
  }

  // 5. Insert security Audit Log
  await supabaseAdmin.from('audit_logs').insert([{
    actor_id: user.id,
    action_type: 'ADD_TENANT_WALLET_CREDIT',
    entity_id: tenantId,
    changes: { amount, timestamp: new Date().toISOString() }
  }]);

  return { success: true };
}
