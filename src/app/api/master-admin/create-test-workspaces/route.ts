import { createClient as createSsrClient } from '@/utils/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function findUserByEmail(supabaseAdmin: any, email: string) {
  let page = 1;
  const perPage = 100;
  const targetEmail = email.toLowerCase().trim();
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage
    });
    if (error || !data?.users || data.users.length === 0) {
      if (error) {
        console.error('[PROVISION] Error listing users:', error);
      }
      break;
    }
    const user = data.users.find((u: any) => u.email?.toLowerCase().trim() === targetEmail);
    if (user) return user;
    if (data.users.length < perPage) break;
    page++;
  }
  return null;
}

export async function POST(req: Request) {
  const headers = {
    'Cache-Control': 'private, no-store',
    'Content-Type': 'application/json'
  };

  try {
    // 1. Authenticate caller using standard SSR server client
    const supabase = await createSsrClient();
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser();

    if (authError || !caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    }

    // 2. Verify caller is a master admin via verify_master_admin_role RPC
    const { data: isMaster } = await supabase.rpc('verify_master_admin_role');
    if (!isMaster) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
    }

    // 3. Load configurations from environment variables
    const agencyEmail = (process.env.TEST_AGENCY_EMAIL || 'agency.test@reportclinics.app').toLowerCase().trim();
    const agencyPassword = process.env.TEST_AGENCY_PASSWORD;
    const tenantEmail = (process.env.TEST_TENANT_EMAIL || 'tenant.test@reportclinics.app').toLowerCase().trim();
    const tenantPassword = process.env.TEST_TENANT_PASSWORD;

    if (!agencyPassword || !tenantPassword) {
      console.error('[PROVISION] Configuration error: TEST_AGENCY_PASSWORD or TEST_TENANT_PASSWORD environment variable is missing.');
      return NextResponse.json({ error: 'Configuration error: Demo account credentials are not configured.' }, { status: 500, headers });
    }

    // 4. Initialize Supabase Admin client using getSupabaseAdminClient
    const supabaseAdmin = getSupabaseAdminClient();

    // Trace status booleans for response
    const statusMap = {
      agencyUser: { reused: false, id: '' },
      agencyRecord: { reused: false, id: '' },
      tenantUser: { reused: false, id: '' },
      tenantRecord: { reused: false, id: '' },
      tenantProfile: { reused: false, id: '' }
    };

    // 5. Provision / Repair Agency Account
    let agencyUser = await findUserByEmail(supabaseAdmin, agencyEmail);
    if (!agencyUser) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: agencyEmail,
        password: agencyPassword,
        email_confirm: true,
        user_metadata: {
          role: 'super_admin',
          is_test_account: true,
          test_account_type: 'agency'
        }
      });
      if (error || !data?.user) {
        console.error('[PROVISION] Error creating agency user:', error);
        return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
      }
      agencyUser = data.user;
      statusMap.agencyUser.reused = false;
    } else {
      statusMap.agencyUser.reused = true;
      // Repair metadata roles and test account identifiers
      const currentMeta = agencyUser.user_metadata || {};
      if (currentMeta.role !== 'super_admin' || !currentMeta.is_test_account || currentMeta.test_account_type !== 'agency') {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(agencyUser.id, {
          user_metadata: {
            ...currentMeta,
            role: 'super_admin',
            is_test_account: true,
            test_account_type: 'agency'
          }
        });
        if (error) {
          console.error('[PROVISION] Error updating agency user metadata:', error);
          return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
        }
      }
    }
    statusMap.agencyUser.id = agencyUser.id;

    // Find and repair / create agency database record
    let agencyRecord = null;
    const { data: agByUid, error: agUidErr } = await supabaseAdmin
      .from('agencies')
      .select('*')
      .eq('user_id', agencyUser.id)
      .maybeSingle();

    if (agUidErr) {
      console.error('[PROVISION] Error querying agency by user_id:', agUidErr);
      return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
    }

    if (agByUid) {
      agencyRecord = agByUid;
    } else {
      const { data: agByEmail, error: agEmailErr } = await supabaseAdmin
        .from('agencies')
        .select('*')
        .eq('contact_email', agencyEmail)
        .maybeSingle();

      if (agEmailErr) {
        console.error('[PROVISION] Error querying agency by email:', agEmailErr);
        return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
      }
      agencyRecord = agByEmail;
    }

    if (!agencyRecord) {
      // Create new agency
      const { data, error } = await supabaseAdmin
        .from('agencies')
        .insert({
          user_id: agencyUser.id,
          name: 'Demo Agency',
          contact_email: agencyEmail,
          subscription_status: 'active',
          plan_type: 'starter',
          commission_rate: 20
        })
        .select()
        .single();

      if (error || !data) {
        console.error('[PROVISION] Error creating agency:', error);
        return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
      }
      agencyRecord = data;
      statusMap.agencyRecord.reused = false;
    } else {
      statusMap.agencyRecord.reused = true;
      // Idempotently repair only ownership, identity, and required test fields
      const agencyUpdate: any = {
        user_id: agencyUser.id,
        contact_email: agencyEmail,
        subscription_status: 'active'
      };

      if (!agencyRecord.name) agencyUpdate.name = 'Demo Agency';
      if (!agencyRecord.plan_type) agencyUpdate.plan_type = 'starter';
      if (agencyRecord.commission_rate === null || agencyRecord.commission_rate === undefined) {
        agencyUpdate.commission_rate = 20;
      }

      const { error } = await supabaseAdmin
        .from('agencies')
        .update(agencyUpdate)
        .eq('id', agencyRecord.id);

      if (error) {
        console.error('[PROVISION] Error repairing agency:', error);
        return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
      }
    }
    statusMap.agencyRecord.id = agencyRecord.id;

    // 6. Provision / Repair Tenant Account
    let tenantUser = await findUserByEmail(supabaseAdmin, tenantEmail);
    if (!tenantUser) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: tenantEmail,
        password: tenantPassword,
        email_confirm: true,
        user_metadata: {
          role: 'admin',
          is_test_account: true,
          test_account_type: 'tenant',
          business_name: 'Demo Tenant Clinic',
          business_type: 'clinic'
        }
      });
      if (error || !data?.user) {
        console.error('[PROVISION] Error creating tenant user:', error);
        return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
      }
      tenantUser = data.user;
      statusMap.tenantUser.reused = false;
    } else {
      statusMap.tenantUser.reused = true;
      const currentMeta = tenantUser.user_metadata || {};
      if (currentMeta.role !== 'admin' || !currentMeta.is_test_account || currentMeta.test_account_type !== 'tenant') {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(tenantUser.id, {
          user_metadata: {
            ...currentMeta,
            role: 'admin',
            is_test_account: true,
            test_account_type: 'tenant'
          }
        });
        if (error) {
          console.error('[PROVISION] Error updating tenant user metadata:', error);
          return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
        }
      }
    }
    statusMap.tenantUser.id = tenantUser.id;

    // Determine target slug and check for collision
    const primarySlug = 'report-clinics-test';
    const altSlug = `report-clinics-test-${tenantUser.id.slice(0, 8)}`;
    let targetSlug = primarySlug;

    const { data: slugOwner, error: slugErr } = await supabaseAdmin
      .from('tenants')
      .select('id, user_id')
      .eq('slug', primarySlug)
      .maybeSingle();

    if (slugErr) {
      console.error('[PROVISION] Error checking slug owner:', slugErr);
      return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
    }

    if (slugOwner && slugOwner.user_id !== tenantUser.id) {
      // Hijack prevention: use deterministic alternative slug
      targetSlug = altSlug;
    }

    // Find existing tenant record
    let tenantRecord = null;
    const { data: tnByUid, error: tnUidErr } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('user_id', tenantUser.id)
      .maybeSingle();

    if (tnUidErr) {
      console.error('[PROVISION] Error querying tenant by user_id:', tnUidErr);
      return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
    }

    if (tnByUid) {
      tenantRecord = tnByUid;
    } else {
      const { data: tnBySlug, error: tnSlugErr } = await supabaseAdmin
        .from('tenants')
        .select('*')
        .eq('slug', targetSlug)
        .maybeSingle();

      if (tnSlugErr) {
        console.error('[PROVISION] Error querying tenant by slug:', tnSlugErr);
        return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
      }
      tenantRecord = tnBySlug;
    }

    // For a new tenant, set a 14 days trial duration limit.
    // For an existing tenant, we preserve the existing trial_ends_at by default
    // and only renew it to 14 days if it has expired and the record is confirmed to belong to this user.
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    if (!tenantRecord) {
      const { data, error } = await supabaseAdmin
        .from('tenants')
        .insert({
          user_id: tenantUser.id,
          name: 'Demo Tenant Clinic',
          type: 'clinic',
          business_type: 'clinic',
          slug: targetSlug,
          status: 'active',
          subscription_tier: 'trial',
          trial_ends_at: trialEndsAt.toISOString(),
          agency_id: agencyRecord.id
        })
        .select()
        .single();

      if (error || !data) {
        console.error('[PROVISION] Error creating tenant:', error);
        return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
      }
      tenantRecord = data;
      statusMap.tenantRecord.reused = false;
    } else {
      statusMap.tenantRecord.reused = true;

      // Determine if the existing test tenant's trial is expired
      const isExpired = tenantRecord.trial_ends_at 
        ? new Date(tenantRecord.trial_ends_at).getTime() < Date.now() 
        : true;

      const trialEndsAtVal = isExpired 
        ? trialEndsAt.toISOString() 
        : tenantRecord.trial_ends_at;

      // Idempotently repair required test fields and linkage
      const tenantUpdate: any = {
        user_id: tenantUser.id,
        status: 'active',
        subscription_tier: 'trial',
        trial_ends_at: trialEndsAtVal,
        agency_id: agencyRecord.id
      };

      if (!tenantRecord.name) tenantUpdate.name = 'Demo Tenant Clinic';
      if (!tenantRecord.type) tenantUpdate.type = 'clinic';
      if (!tenantRecord.business_type) tenantUpdate.business_type = 'clinic';
      if (!tenantRecord.slug) tenantUpdate.slug = targetSlug;

      const { error } = await supabaseAdmin
        .from('tenants')
        .update(tenantUpdate)
        .eq('id', tenantRecord.id);

      if (error) {
        console.error('[PROVISION] Error repairing tenant:', error);
        return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
      }
    }
    statusMap.tenantRecord.id = tenantRecord.id;

    // 7. Provision / Repair Tenant Admin Profile
    const { data: existingProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', tenantUser.id)
      .maybeSingle();

    if (profileErr) {
      console.error('[PROVISION] Error querying profile:', profileErr);
      return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
    }

    if (!existingProfile) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: tenantUser.id,
          tenant_id: tenantRecord.id,
          full_name: 'Demo Tenant Admin',
          email: tenantEmail,
          role: 'admin'
        });

      if (error) {
        console.error('[PROVISION] Error creating profile:', error);
        return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
      }
      statusMap.tenantProfile.reused = false;
    } else {
      statusMap.tenantProfile.reused = true;
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          tenant_id: tenantRecord.id,
          email: tenantEmail,
          role: 'admin'
        })
        .eq('id', tenantUser.id);

      if (error) {
        console.error('[PROVISION] Error repairing profile:', error);
        return NextResponse.json({ error: 'Database provisioning failed.' }, { status: 500, headers });
      }
    }
    statusMap.tenantProfile.id = tenantUser.id;

    // 8. Audit Logging with Explicit Error Handling
    try {
      const { error: auditError } = await supabaseAdmin.from('audit_logs').insert([{
        actor_id: caller.id,
        action_type: 'PROVISION_TEST_WORKSPACES',
        entity_type: 'system',
        changes: {
          agency_user_id: agencyUser.id,
          agency_id: agencyRecord.id,
          tenant_user_id: tenantUser.id,
          tenant_id: tenantRecord.id
        }
      }]);
      if (auditError) {
        console.error('[PROVISION] Audit log insert failed:', auditError.message);
      }
    } catch (auditException) {
      console.error('[PROVISION] Audit logging exception caught:', auditException);
    }

    return NextResponse.json({
      success: true,
      message: 'Test workspaces provisioned/repaired successfully.',
      details: statusMap
    }, { status: 200, headers });

  } catch (error: any) {
    console.error('[PROVISION] Unhandled exception occurred:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500, headers });
  }
}
