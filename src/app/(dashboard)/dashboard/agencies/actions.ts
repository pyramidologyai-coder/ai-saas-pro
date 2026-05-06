'use server';

import { createClient } from '@supabase/supabase-js';

// Sanitize keys to remove invisible BOM characters injected by copy-paste
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/[^\x20-\x7E]/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[^\x20-\x7E]/g, '').trim();

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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
  const { error: auditError } = await supabaseAdmin.from('audit_logs').insert({
    actor_id: adminId,
    action_type: 'CREATE_AGENCY',
    entity_type: 'agency',
    changes: { 
      agency_name: agencyData.name, 
      agency_id: agency.id 
    }
  });

  if (auditError) {
    console.error('Audit log failed:', auditError.message);
  }

  return agency;
}

export async function updateAgencyCommissionAction(agencyId: string, newRate: number, adminId: string) {
  const { error } = await supabaseAdmin.from('agencies')
    .update({ commission_rate: newRate })
    .eq('id', agencyId);
  
  if (error) throw new Error(error.message);

  const { error: auditError } = await supabaseAdmin.from('audit_logs').insert({
    actor_id: adminId,
    action_type: 'UPDATE_AGENCY_COMMISSION',
    entity_type: 'agency',
    changes: { agency_id: agencyId, new_rate: newRate }
  });

  if (auditError) {
    console.error('Audit log failed:', auditError.message);
  }
}
