import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  createStaffUserClient,
  getAuthenticatedStaffRequester,
  getRequestBearerToken,
  getTenantOwnerAccess,
} from '@/lib/staff-authz';
import { sanitizeStaffPermissions, validateAssignableStaffRole } from '@/lib/staff-roles';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      full_name,
      email,
      role,
      branch_access,
      permissions,
      tenant_id,
      token: bodyToken,
    } = body;

    const token = getRequestBearerToken(req, bodyToken);

    if (!full_name || !email || !role || !tenant_id || !token) {
      return NextResponse.json(
        { error: 'Missing required parameters (full_name, email, role, tenant_id, token).' },
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
    const tempPassword = crypto.randomBytes(8).toString('hex') + 'St@ff1';

    const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    });

    if (createError) {
      const isAlreadyRegistered =
        createError.message?.toLowerCase().includes('already') ||
        createError.message?.toLowerCase().includes('registered') ||
        createError.status === 422;

      if (isAlreadyRegistered) {
        return NextResponse.json({ error: 'Email is already registered.' }, { status: 400 });
      }

      return NextResponse.json({ error: 'Failed to create auth user account.' }, { status: 500 });
    }

    if (!authUser?.user) {
      return NextResponse.json({ error: 'Failed to create auth user account.' }, { status: 500 });
    }

    const newUserId = authUser.user.id;
    const { error: insertError } = await supabaseAdmin.from('profiles').insert({
      id: newUserId,
      tenant_id,
      full_name,
      email,
      role: roleValidation.role,
      branch_access: branch_access || [],
      permissions: permissionsValidation.permissions,
    });

    if (insertError) {
      console.error('Failed to create staff profile. Rolling back auth user account creation.', insertError);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);

      return NextResponse.json({ error: 'Database error inserting staff profile.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Staff user account and profile created successfully.',
      user: {
        id: newUserId,
        email,
        full_name,
        role: roleValidation.role,
        temp_password: tempPassword,
      },
    });
  } catch (error) {
    console.error('Staff creation API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
