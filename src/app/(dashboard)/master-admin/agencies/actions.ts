'use server';

import { Resend } from 'resend';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export async function createAgencyAction(agencyData: any, adminId: string) {
  const supabaseAdmin = getSupabaseAdminClient();
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

  // 3. تحقق لو الإيميل موجود بشكل قوي ومكتمل الصفحات عبر listUsers
  let userExists = null;
  try {
    let page = 1;
    const perPage = 100;
    
    while (true) {
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage
      });
      
      if (listError || !listData?.users || listData.users.length === 0) {
        break;
      }
      
      const found = listData.users.find(u => u.email?.toLowerCase().trim() === cleanEmail);
      if (found) {
        userExists = found;
        break;
      }
      
      if (listData.users.length < perPage) {
        break;
      }
      page++;
    }
  } catch (err) {
    console.error('Error during listUsers lookup:', err);
  }

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

  // إرسال إيميل تفعيل حساب وحفاوة للوكالة باستخدام Resend
  try {
    // تحقق إن الإيميل صح قبل الإرسال
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('invalid_email_for_reset');
    }
    // تحقق إن الـ APP_URL موجود
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://reportclinics.vercel.app';
    const { data: linkData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: {
        redirectTo: `${appUrl}/auth/callback`
      }
    });

    if (resetError) {
      console.error('Recovery link generation failed:', resetError.message);
    } else if (linkData?.properties?.action_link) {
      const actionLink = linkData.properties.action_link;
      const resendApiKey = process.env.RESEND_API_KEY;

      if (resendApiKey) {
        const resendClient = new Resend(resendApiKey);
        const emailHtml = `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
            <h2 style="color: #8b5cf6; text-align: center; font-size: 24px; margin-bottom: 20px;">مرحباً بك في منصة Report Clinics 🚀</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">أهلاً بك <strong>${cleanName}</strong> شريكاً معنا،</p>
            <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">يسعدنا انضمامك إلينا كشريك معتمد بالمنصة. تم إنشاء حساب الوكالة الخاص بك بنجاح، ويمكنك الآن تفعيل حسابك وتعيين كلمة المرور والبدء في تهيئة لوحة التحكم وإضافة عملائك.</p>
            <div style="text-align: center; margin: 35px 0;">
              <a href="${actionLink}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: #ffffff; padding: 14px 30px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">تفعيل الحساب وتعيين كلمة المرور</a>
            </div>
            <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">Pyramidology AI &copy; 2026</p>
          </div>
        `;

        const { data: emailRes, error: emailError } = await resendClient.emails.send({
          from: 'no-reply@pyramidology.ai',
          to: cleanEmail,
          subject: 'تفعيل حساب وكالتك الجديدة - Report Clinics 🚀',
          html: emailHtml,
        });

        if (!emailError) {
          console.log("Welcome email sent via Resend SDK successfully.", emailRes);
          await supabaseAdmin
            .from('audit_logs')
            .insert({
              actor_id: adminId,
              action_type: 'SEND_WELCOME_EMAIL',
              entity_type: 'agency',
              changes: {
                agency_id: agency.id,
                email_sent: true
              }
            });
        } else {
          console.error("Resend SDK welcome email failed:", emailError.message);
        }
      } else {
        console.warn("RESEND_API_KEY is not defined in env variables.");
      }
    }
  } catch (emailError) {
    console.error(
      'Email process error:', 
      emailError instanceof Error ? emailError.message : 'unknown'
    );
  }

  return agency;
}

export async function updateAgencyCommissionAction(agencyId: string, newRate: number, adminId: string) {
  const supabaseAdmin = getSupabaseAdminClient();
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
