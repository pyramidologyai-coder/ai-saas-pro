import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore as any
    });

    // 1. Authenticate caller
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify caller is a master admin
    const { data: isMaster } = await supabase.rpc('verify_master_admin_role');
    if (!isMaster) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Initialize sanitized service role client locally (as no shared helper exists)
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/[^\x20-\x7E]/g, '').trim();
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[^\x20-\x7E]/g, '').trim();
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // 3. Provision/Repair Agency test user and agency record
    const agencyEmail = 'agency.test@reportclinics.app';
    const agencyPassword = 'DemoAgency123!';
    let agencyUserId: string;

    // Search for existing user in auth
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ error: 'Failed to fetch users: ' + listError.message }, { status: 500 });
    }

    let existingAgencyUser = listData.users.find(u => u.email?.toLowerCase().trim() === agencyEmail);
    if (!existingAgencyUser) {
      // Create user
      const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: agencyEmail,
        password: agencyPassword,
        email_confirm: true,
        user_metadata: { role: 'super_admin' }
      });
      if (createUserError) {
        return NextResponse.json({ error: 'Failed to create agency user: ' + createUserError.message }, { status: 500 });
      }
      existingAgencyUser = createdUser.user;
    } else {
      // Repair user metadata role if needed
      if (existingAgencyUser.user_metadata?.role !== 'super_admin') {
        const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(existingAgencyUser.id, {
          user_metadata: { ...existingAgencyUser.user_metadata, role: 'super_admin' }
        });
        if (updateUserError) {
          return NextResponse.json({ error: 'Failed to update agency user metadata: ' + updateUserError.message }, { status: 500 });
        }
      }
    }
    agencyUserId = existingAgencyUser.id;

    // Create or repair agency database record
    const { data: existingAgency, error: agencySelectError } = await supabaseAdmin
      .from('agencies')
      .select('*')
      .eq('user_id', agencyUserId)
      .maybeSingle();

    if (agencySelectError) {
      return NextResponse.json({ error: 'Failed to query agency: ' + agencySelectError.message }, { status: 500 });
    }

    let agencyId: string;
    if (!existingAgency) {
      const { data: newAgency, error: agencyInsertError } = await supabaseAdmin
        .from('agencies')
        .insert({
          user_id: agencyUserId,
          name: 'Demo Agency',
          contact_email: agencyEmail,
          subscription_status: 'active',
          plan_type: 'starter',
          commission_rate: 20
        })
        .select()
        .single();
      if (agencyInsertError) {
        return NextResponse.json({ error: 'Failed to create agency: ' + agencyInsertError.message }, { status: 500 });
      }
      agencyId = newAgency.id;
    } else {
      agencyId = existingAgency.id;
      // Repair agency status, plan, etc.
      const { error: agencyUpdateError } = await supabaseAdmin
        .from('agencies')
        .update({
          name: 'Demo Agency',
          subscription_status: 'active',
          plan_type: 'starter',
          commission_rate: 20
        })
        .eq('id', agencyId);
      if (agencyUpdateError) {
        return NextResponse.json({ error: 'Failed to repair agency: ' + agencyUpdateError.message }, { status: 500 });
      }
    }

    // 4. Provision/Repair Tenant test user, tenant record, and profile
    const tenantEmail = 'tenant.test@reportclinics.app';
    const tenantPassword = 'DemoTenant123!';
    let tenantUserId: string;

    let existingTenantUser = listData.users.find(u => u.email?.toLowerCase().trim() === tenantEmail);
    if (!existingTenantUser) {
      // Create user - trigger handle_new_user_tenant will automatically insert a tenant row in tenants
      const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: tenantEmail,
        password: tenantPassword,
        email_confirm: true,
        user_metadata: {
          role: 'admin',
          business_name: 'Demo Tenant Clinic',
          business_type: 'clinic'
        }
      });
      if (createUserError) {
        return NextResponse.json({ error: 'Failed to create tenant user: ' + createUserError.message }, { status: 500 });
      }
      existingTenantUser = createdUser.user;
    } else {
      // Repair user metadata role if needed
      if (existingTenantUser.user_metadata?.role !== 'admin') {
        const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(existingTenantUser.id, {
          user_metadata: { ...existingTenantUser.user_metadata, role: 'admin' }
        });
        if (updateUserError) {
          return NextResponse.json({ error: 'Failed to update tenant user metadata: ' + updateUserError.message }, { status: 500 });
        }
      }
    }
    tenantUserId = existingTenantUser.id;

    // Check/create/repair tenant database record
    const { data: existingTenant, error: tenantSelectError } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('user_id', tenantUserId)
      .maybeSingle();

    if (tenantSelectError) {
      return NextResponse.json({ error: 'Failed to query tenant: ' + tenantSelectError.message }, { status: 500 });
    }

    let tenantId: string;
    const futureTrialEnds = new Date();
    futureTrialEnds.setFullYear(futureTrialEnds.getFullYear() + 1); // 1 year trial

    if (!existingTenant) {
      const { data: newTenant, error: tenantInsertError } = await supabaseAdmin
        .from('tenants')
        .insert({
          user_id: tenantUserId,
          name: 'Demo Tenant Clinic',
          type: 'clinic',
          slug: 'demo-tenant-clinic-' + Math.floor(Math.random() * 100000),
          status: 'active',
          subscription_tier: 'starter',
          trial_ends_at: futureTrialEnds.toISOString(),
          agency_id: agencyId
        })
        .select()
        .single();
      if (tenantInsertError) {
        return NextResponse.json({ error: 'Failed to create tenant record: ' + tenantInsertError.message }, { status: 500 });
      }
      tenantId = newTenant.id;
    } else {
      tenantId = existingTenant.id;
      // Repair tenant record
      const { error: tenantUpdateError } = await supabaseAdmin
        .from('tenants')
        .update({
          name: 'Demo Tenant Clinic',
          status: 'active',
          plan_type: 'starter',
          trial_ends_at: futureTrialEnds.toISOString(),
          agency_id: agencyId
        })
        .eq('id', tenantId);
      if (tenantUpdateError) {
        return NextResponse.json({ error: 'Failed to repair tenant record: ' + tenantUpdateError.message }, { status: 500 });
      }
    }

    // Check/create/repair tenant admin profile
    const { data: existingProfile, error: profileSelectError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', tenantUserId)
      .maybeSingle();

    if (profileSelectError) {
      return NextResponse.json({ error: 'Failed to query profile: ' + profileSelectError.message }, { status: 500 });
    }

    if (!existingProfile) {
      const { error: profileInsertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: tenantUserId,
          tenant_id: tenantId,
          full_name: 'Demo Tenant Admin',
          email: tenantEmail,
          role: 'admin'
        });
      if (profileInsertError) {
        return NextResponse.json({ error: 'Failed to create profile: ' + profileInsertError.message }, { status: 500 });
      }
    } else {
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          tenant_id: tenantId,
          email: tenantEmail,
          role: 'admin',
          full_name: 'Demo Tenant Admin'
        })
        .eq('id', tenantUserId);
      if (profileUpdateError) {
        return NextResponse.json({ error: 'Failed to repair profile: ' + profileUpdateError.message }, { status: 500 });
      }
    }

    // Stealth Audit Logging
    await supabaseAdmin.from('audit_logs').insert([{
      actor_id: user.id,
      action_type: 'PROVISION_TEST_WORKSPACES',
      entity_type: 'system',
      changes: {
        agency_user_id: agencyUserId,
        agency_id: agencyId,
        tenant_user_id: tenantUserId,
        tenant_id: tenantId
      }
    }]);

    return NextResponse.json({
      success: true,
      message: 'Test workspaces provisioned/repaired successfully.',
      details: {
        agency: {
          email: agencyEmail,
          userId: agencyUserId,
          agencyId: agencyId
        },
        tenant: {
          email: tenantEmail,
          userId: tenantUserId,
          tenantId: tenantId
        }
      }
    });

  } catch (error: any) {
    console.error('Error provisioning test workspaces:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
