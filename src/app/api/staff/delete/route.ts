import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  createStaffUserClient,
  getAuthenticatedStaffRequester,
  getRequestBearerToken,
  getTenantOwnerAccess,
  hasProtectedAuthAppRole,
  isProtectedStaffTarget,
  type TargetProfile,
} from '@/lib/staff-authz';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { staff_id, tenant_id, token: bodyToken } = body;

    const token = getRequestBearerToken(req, bodyToken);

    if (!staff_id || !tenant_id || !token) {
      return NextResponse.json(
        { error: 'Missing required parameters (staff_id, tenant_id, token).' },
        { status: 400 }
      );
    }

    const supabaseUserClient = createStaffUserClient(token);
    const { user, error: authError } = await getAuthenticatedStaffRequester(supabaseUserClient);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: invalid credentials or token.' }, { status: 401 });
    }

    const tenantAccess = await getTenantOwnerAccess(supabaseUserClient, tenant_id, user);
    if (!tenantAccess.ok) {
      return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, tenant_id, role')
      .eq('id', staff_id)
      .maybeSingle();

    const targetProfile = data as TargetProfile | null;

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Target staff profile was not found.' }, { status: 404 });
    }

    if (targetProfile.tenant_id !== tenant_id) {
      return NextResponse.json(
        { error: 'Forbidden: target staff profile belongs to another tenant.' },
        { status: 403 }
      );
    }

    const { data: authTarget } = await supabaseAdmin.auth.admin.getUserById(staff_id);
    if (isProtectedStaffTarget(targetProfile, tenantAccess.tenant) || hasProtectedAuthAppRole(authTarget?.user)) {
      return NextResponse.json(
        { error: 'Forbidden: protected staff identity cannot be deleted.' },
        { status: 403 }
      );
    }

    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', staff_id)
      .eq('tenant_id', tenant_id);

    if (profileDeleteError) {
      return NextResponse.json({ error: 'Failed to delete staff profile.' }, { status: 500 });
    }

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(staff_id);

    if (authDeleteError) {
      return NextResponse.json({ error: 'Failed to delete staff auth account.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Staff account and profile deleted successfully.',
    });
  } catch (error) {
    console.error('Staff deletion API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
