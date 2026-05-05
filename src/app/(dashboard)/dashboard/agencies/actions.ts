'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createAgencyAction(agencyData: any, adminId: string) {
  // 1. Create user in auth.users
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: agencyData.email,
    password: 'TempPassword123!', // You should ideally send them a password reset email
    email_confirm: true,
    user_metadata: { role: 'super_admin' }
  });

  if (authError) throw new Error(authError.message);

  const newUserId = authData.user.id;

  // 2. Insert into agencies
  const { data: agency, error: agencyError } = await supabaseAdmin.from('agencies').insert({
    user_id: newUserId,
    name: agencyData.name,
    contact_email: agencyData.email,
    whatsapp_number: agencyData.whatsapp,
    plan_type: agencyData.plan_slug,
    commission_rate: agencyData.commission_rate,
    subscription_status: 'active'
  }).select().single();

  if (agencyError) throw new Error(agencyError.message);

  // 3. Log to audit_logs
  await supabaseAdmin.from('audit_logs').insert({
    user_id: adminId,
    action: 'CREATE_AGENCY',
    details: { agency_name: agencyData.name, agency_id: agency.id }
  });

  return agency;
}

export async function updateAgencyCommissionAction(agencyId: string, newRate: number, adminId: string) {
  const { error } = await supabaseAdmin.from('agencies')
    .update({ commission_rate: newRate })
    .eq('id', agencyId);
  
  if (error) throw new Error(error.message);

  await supabaseAdmin.from('audit_logs').insert({
    user_id: adminId,
    action: 'UPDATE_AGENCY_COMMISSION',
    details: { agency_id: agencyId, new_rate: newRate }
  });
}
