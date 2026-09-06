import { NextRequest, NextResponse } from 'next/server';
import { getGoogleTokens } from '@/lib/googleCalendar';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');

  if (!code || !stateParam) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // CSRF: compare state param to the HttpOnly cookie set at OAuth initiation
  const cookieState = req.cookies.get('oauth_state')?.value;

  if (!cookieState || cookieState !== stateParam) {
    console.error('[SECURITY] OAuth CSRF attempt blocked — state mismatch.');
    return NextResponse.json({ error: 'Security Violation: State Mismatch (CSRF)' }, { status: 403 });
  }

  // Parse composite state: "tenantId" or "tenantId|memberId"
  const [parsedTenantId, parsedMemberId] = stateParam.split('|');

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(parsedTenantId) || (parsedMemberId && !uuidRegex.test(parsedMemberId))) {
    console.error('[SECURITY] OAuth callback received invalid state UUID format.');
    return NextResponse.json({ error: 'Invalid state format' }, { status: 400 });
  }

  // IDOR: verify the authenticated user actually owns this tenant
  // Extract Supabase session from the auth cookie sent alongside this request
  const authToken = req.cookies.get('sb-access-token')?.value
    ?? req.cookies.get(`sb-${new URL(supabaseUrl!).hostname.split('.')[0]}-auth-token`)?.value;

  if (!authToken) {
    console.error('[SECURITY] OAuth callback — no authenticated session found.');
    return NextResponse.redirect(new URL('/auth', req.url));
  }

  const supabaseUser = createClient(supabaseUrl!, supabaseAnonKey!);
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser(authToken);

  if (authError || !user) {
    console.error('[SECURITY] OAuth callback — invalid session token.');
    return NextResponse.redirect(new URL('/auth', req.url));
  }

  // Confirm the authenticated user owns the tenant in the state param
  const { data: tenantRow } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('id', parsedTenantId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!tenantRow) {
    console.error(`[SECURITY] OAuth IDOR blocked — user ${user.id} does not own tenant ${parsedTenantId}.`);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const tokens = await getGoogleTokens(code);

    if (!tokens.refresh_token) {
      console.warn('[CALENDAR] No refresh token received — user may need to revoke access and retry.');
    }

    // Delete CSRF cookie before writing tokens (fail-open is acceptable here)
    const clearCookie = (res: NextResponse) => {
      res.cookies.delete('oauth_state');
      return res;
    };

    if (parsedMemberId) {
      // Confirm the member belongs to the verified tenant
      const { data: memberRow } = await supabaseAdmin
        .from('team_members')
        .select('id')
        .eq('id', parsedMemberId)
        .eq('tenant_id', parsedTenantId)
        .maybeSingle();

      if (!memberRow) {
        console.error(`[SECURITY] OAuth IDOR blocked — member ${parsedMemberId} does not belong to tenant ${parsedTenantId}.`);
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { error } = await supabaseAdmin
        .from('team_members')
        .update({ google_calendar_refresh_token: tokens.refresh_token ?? null })
        .eq('id', parsedMemberId);

      if (error) throw error;
      return clearCookie(NextResponse.redirect(new URL('/team?calendar_connected=true', req.url)));
    }

    const { error } = await supabaseAdmin
      .from('tenants')
      .update({ google_calendar_refresh_token: tokens.refresh_token ?? null })
      .eq('id', parsedTenantId);

    if (error) throw error;
    return clearCookie(NextResponse.redirect(new URL('/settings?calendar_connected=true', req.url)));

  } catch (error: any) {
    console.error('[CALENDAR] OAuth callback error:', error.message);
    return NextResponse.redirect(new URL('/settings?calendar_error=true', req.url));
  }
}
