import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      staff_id,
      tenant_id, 
      token: bodyToken
    } = body;

    // Retrieve token from Authorization header if not supplied in body
    const authHeader = req.headers.get('Authorization');
    const token = bodyToken || (authHeader ? authHeader.replace('Bearer ', '') : null);

    // 1. Validate required fields
    if (!staff_id || !tenant_id || !token) {
      return NextResponse.json(
        { error: 'معلمات غير مكتملة (staff_id, tenant_id, token)' }, 
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Sanitize credentials to strip any terminal corruption
    const sanitizedUrl = supabaseUrl.replace(/[^\x20-\x7E]/g, '').trim();
    const sanitizedAnonKey = supabaseAnonKey.replace(/[^\x20-\x7E]/g, '').trim();

    // 2. Auth Check: Verify owner credentials via anon client under user context
    const supabaseUserClient = createClient(sanitizedUrl, sanitizedAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Retrieve authenticated user from the token to confirm identity
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'غير مصرح: جلسة العمل منتهية أو التوكن غير صالح' }, 
        { status: 401 }
      );
    }

    // RLS check: Query tenants table
    const { data: tenantData, error: tenantError } = await supabaseUserClient
      .from('tenants')
      .select('id, user_id')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenantData) {
      return NextResponse.json(
        { error: 'غير مسموح: لا تملك صلاحية الوصول الإداري لمساحة العمل هذه' }, 
        { status: 403 }
      );
    }

    // Security check: Confirm user is the direct primary owner of this tenant
    if (tenantData.user_id !== user.id) {
      return NextResponse.json(
        { error: 'غير مسموح: مالك العيادة الرئيسي فقط هو من يحق له حذف حسابات الموظفين' }, 
        { status: 403 }
      );
    }

    // 3. Authorization verified. Instantiate secure Admin client
    const supabaseAdmin = getSupabaseAdminClient();

    // 4. Validate target employee belongs to the same tenant to prevent cross-tenant hijacking/malicious deletions
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, tenant_id')
      .eq('id', staff_id)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return NextResponse.json(
        { error: 'الموظف المطلوب حذفه غير موجود بقاعدة البيانات' },
        { status: 404 }
      );
    }

    if (targetProfile.tenant_id !== tenant_id) {
      return NextResponse.json(
        { error: 'غير مسموح: لا يمكن حذف موظف ينتمي لعيادة أو نشاط تجاري آخر' },
        { status: 403 }
      );
    }

    // 5. Delete employee profile from public.profiles explicitly for extra safety
    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', staff_id);

    if (profileDeleteError) {
      return NextResponse.json(
        { error: `فشل حذف البيانات من جدول profiles: ${profileDeleteError.message}` },
        { status: 500 }
      );
    }

    // 6. Delete user account from auth.users using admin api
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(staff_id);

    if (authDeleteError) {
      return NextResponse.json(
        { error: `فشل حذف الحساب من auth.users: ${authDeleteError.message}` },
        { status: 500 }
      );
    }

    // 7. Return success response
    return NextResponse.json({
      success: true,
      message: 'تم حذف حساب الموظف وملفه الشخصي بنجاح ✅'
    });

  } catch (error: any) {
    console.error('Staff deletion API error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
