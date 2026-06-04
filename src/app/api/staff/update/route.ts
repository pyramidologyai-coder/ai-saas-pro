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
import { sanitizeStaffPermissions, validateAssignableStaffRole } from '@/lib/staff-roles';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      staff_id,
      tenant_id,
      token: bodyToken,
      full_name,
      role,
      branch_access,
      permissions,
    } = body;

    const token = getRequestBearerToken(req, bodyToken);

    if (!staff_id || !tenant_id || !token || !full_name || !role) {
      return NextResponse.json(
        { error: 'Missing required parameters (staff_id, tenant_id, token, full_name, role).' },
        { status: 400 }
      );
    }

    const roleValidation = validateAssignableStaffRole(role, { allowTenantAdmin: true });
    if (!roleValidation.ok) {
      return NextResponse.json({ error: roleValidation.error }, { status: roleValidation.status });
    }

    const permissionsValidation = sanitizeStaffPermissions(permissions);
    if (!permissionsValidation.ok) {
      return NextResponse.json({ error: permissionsValidation.error }, { status: 400 });
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
        { error: 'Forbidden: protected staff identity cannot be modified.' },
        { status: 403 }
      );
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        role: roleValidation.role,
        branch_access: branch_access || [],
        permissions: permissionsValidation.permissions,
      })
      .eq('id', staff_id)
      .eq('tenant_id', tenant_id);

    if (profileUpdateError) {
      return NextResponse.json({ error: 'Failed to update staff profile.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Staff profile updated successfully.',
    });
  } catch (error) {
    console.error('Staff update API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
