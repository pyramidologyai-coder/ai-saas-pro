import { NextResponse } from 'next/server';
import { getGoogleTokens } from '@/lib/googleCalendar';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy'
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const tenantId = url.searchParams.get('state');

  // SECURITY: OAuth CSRF Protection using cookies
  const cookieState = req.headers.get('cookie')?.split('; ').find(row => row.startsWith('oauth_state='))?.split('=')[1];
  
  if (!code || !tenantId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  if (!cookieState || cookieState !== tenantId) {
    console.error(`[SECURITY ALERT] OAuth CSRF Attempt blocked. State mismatch.`);
    return NextResponse.json({ error: 'Security Violation: State Mismatch (CSRF)' }, { status: 403 });
  }

  try {
    // 1. Exchange code for tokens
    const tokens = await getGoogleTokens(code);

    if (!tokens.refresh_token) {
      console.warn('No refresh token received. User might need to revoke access and try again.');
    }

    // 2. Save tokens to Supabase (using Admin client because user isn't authenticated in this callback via Bearer)
    const [parsedTenantId, parsedMemberId] = tenantId.split('|');

    if (parsedMemberId) {
      const { error } = await supabaseAdmin
        .from('team_members')
        .update({ google_calendar_refresh_token: tokens.refresh_token || null })
        .eq('id', parsedMemberId);

      if (error) throw error;
      const res = NextResponse.redirect(new URL('/team?calendar_connected=true', req.url));
      res.cookies.delete('oauth_state');
      return res;
    } else {
      const { error } = await supabaseAdmin
        .from('tenants')
        .update({ google_calendar_refresh_token: tokens.refresh_token || null })
        .eq('id', parsedTenantId);

      if (error) throw error;
      const res = NextResponse.redirect(new URL('/settings?calendar_connected=true', req.url));
      res.cookies.delete('oauth_state');
      return res;
    }

  } catch (error: any) {
    console.error('Google OAuth Callback Error:', error.message);
    return NextResponse.redirect(new URL('/team?calendar_error=true', req.url));
  }
}
