'use server';

import { createClient } from '@supabase/supabase-js';

// Sanitize keys to remove invisible BOM characters injected by copy-paste
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/[^\x20-\x7E]/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[^\x20-\x7E]/g, '').trim();

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function createAgencyAction(agencyData: any, adminId: string) {
  // 1. التحقق من المدخلات أولاً
  if (!agencyData.email || !agencyData.email.includes('@')) {
    throw new Error('invalid_email');
  }

  if (!agencyData.name || agencyData.name.length > 100) {
    throw new Error('invalid_name');
  }

  if (agencyData.commission_rate < 0 || agencyData.commission_rate > 50) {
    throw new Error('invalid_commission');
  }

  // 2. تنظيف المدخلات
  const cleanEmail = agencyData.email.toLowerCase().trim();
  const cleanName = agencyData.name.trim();

  // 3. تحقق لو الإيميل موجود
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();

  const userExists = existingUsers?.users?.find(
    u => u.email === cleanEmail
  );

  let newUserId: string;

  if (userExists) {
    // استخدم الـ ID الموجود
    newUserId = userExists.id;
    
    // تحقق إن مفيش agency لنفس الـ user
    const { data: existingAgency } = await supabaseAdmin
      .from('agencies')
      .select('id')
      .eq('user_id', newUserId)
      .single();
      
    if (existingAgency) {
      throw new Error('agency_already_exists');
    }
    
  } else {
    // اعمل user جديد
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: 'TempPass' + Math.random().toString(36).slice(2) + '!A1',
      email_confirm: true,
      user_metadata: { role: 'super_admin' }
    });
    
    if (authError) {
      console.error('Auth error:', authError.message);
      throw new Error('user_creation_failed');
    }
    newUserId = authData.user.id;
  }

  // 4. إنشاء الوكالة
  const { data: agency, error: agencyError } = await supabaseAdmin
    .from('agencies')
    .insert({
      user_id: newUserId,
      name: cleanName,
      contact_email: cleanEmail,
      whatsapp_number: agencyData.whatsapp,
      plan_type: agencyData.plan_slug,
      commission_rate: agencyData.commission_rate,
      subscription_status: 'active'
    })
    .select()
    .single();

  if (agencyError) {
    console.error('Agency error:', agencyError.message);
    throw new Error('agency_creation_failed');
  }

  // 5. audit_logs
  const { error: auditError } = await supabaseAdmin
    .from('audit_logs')
    .insert({
      actor_id: adminId,
      action_type: 'CREATE_AGENCY',
      entity_type: 'agency',
      changes: {
        agency_id: agency.id,
        agency_name: cleanName
      }
    });

  if (auditError) {
    console.error('Audit error:', auditError.message);
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
