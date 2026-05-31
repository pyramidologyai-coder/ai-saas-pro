import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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
      token: bodyToken 
    } = body;

    // Retrieve token from Authorization header if not supplied in body
    const authHeader = req.headers.get('Authorization');
    const token = bodyToken || (authHeader ? authHeader.replace('Bearer ', '') : null);

    // 1. Validate required fields
    if (!full_name || !email || !role || !tenant_id || !token) {
      return NextResponse.json(
        { error: 'Missing required parameters (full_name, email, role, tenant_id, token)' }, 
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Sanitize credentials to strip any terminal corruption
    const sanitizedUrl = supabaseUrl.replace(/[^\x20-\x7E]/g, '').trim();
    const sanitizedAnonKey = supabaseAnonKey.replace(/[^\x20-\x7E]/g, '').trim();
    const sanitizedServiceKey = serviceRoleKey.replace(/[^\x20-\x7E]/g, '').trim();

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
        { error: 'Unauthorized: Invalid credentials or token' }, 
        { status: 401 }
      );
    }

    // RLS check: Query tenants table.
    const { data: tenantData, error: tenantError } = await supabaseUserClient
      .from('tenants')
      .select('id, user_id')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenantData) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have administrative owner access to this Workspace' }, 
        { status: 403 }
      );
    }

    // Security check: Confirm user is the direct primary owner of this tenant
    if (tenantData.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Only the primary workspace owner can register staff accounts' }, 
        { status: 403 }
      );
    }

    // 3. Authorization verified. Instantiate secure Admin client
    const supabaseAdmin = createClient(sanitizedUrl, sanitizedServiceKey);

    // 4. Generate secure random temporary password server-side
    // Contains random hex, an uppercase letter, and special character
    const tempPassword = crypto.randomBytes(8).toString('hex') + 'St@ff1';

    // 5. Create user account in auth.users
    const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role,
        full_name,
        tenant_id
      }
    });

    if (createError) {
      // User-friendly error message if the email is already registered
      const isAlreadyRegistered = createError.message?.toLowerCase().includes('already') || 
                                  createError.message?.toLowerCase().includes('registered') ||
                                  createError.status === 422;

      if (isAlreadyRegistered) {
        return NextResponse.json(
          { error: 'الإيميل ده مستخدم بالفعل، اختر إيميل تاني للموظف' }, 
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: `Failed to create auth user account: ${createError?.message}` }, 
        { status: 500 }
      );
    }

    if (!authUser?.user) {
      return NextResponse.json(
        { error: 'Failed to create auth user account: unknown error' }, 
        { status: 500 }
      );
    }

    const newUserId = authUser.user.id;

    // 6. Insert new record in public.profiles table
    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUserId,
        tenant_id,
        full_name,
        email,
        role,
        branch_access: branch_access || [],
        permissions: permissions || {}
      });

    // 7. Security rollback (atomic transaction simulation)
    if (insertError) {
      console.error('Failed to create profile. Rolling back auth user account creation.', insertError);
      
      // Delete user from auth.users
      await supabaseAdmin.auth.admin.deleteUser(newUserId);

      return NextResponse.json(
        { error: `Database error inserting profile: ${insertError.message}` }, 
        { status: 500 }
      );
    }

    // 8. Return success response
    return NextResponse.json({
      success: true,
      message: 'Staff user account and profile created successfully.',
      user: {
        id: newUserId,
        email,
        full_name,
        role,
        temp_password: tempPassword
      }
    });

  } catch (error: any) {
    console.error('Staff creation API error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
