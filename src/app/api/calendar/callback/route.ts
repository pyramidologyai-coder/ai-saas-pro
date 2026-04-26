import { NextResponse } from 'next/server';
import { getGoogleTokens } from '@/lib/googleCalendar';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const tenantId = url.searchParams.get('state'); // Note: tenantId here could be 'tenantId' or 'tenantId|memberId'

  if (!code || !tenantId) {
    return NextResponse.json({ error: 'Missing code or state parameter' }, { status: 400 });
  }

  try {
    // 1. Exchange code for tokens
    const tokens = await getGoogleTokens(code);

    if (!tokens.refresh_token) {
      console.warn('No refresh token received. User might need to revoke access and try again.');
    }

    // 2. Save tokens to Supabase
    const [parsedTenantId, parsedMemberId] = tenantId.split('|');

    if (parsedMemberId) {
      // It's a team member connection
      const { error } = await supabase
        .from('team_members')
        .update({
          google_calendar_refresh_token: tokens.refresh_token || null,
        })
        .eq('id', parsedMemberId);

      if (error) throw error;
      return NextResponse.redirect(new URL('/team?calendar_connected=true', req.url));
    } else {
      // It's a main tenant connection (legacy/fallback)
      const { error } = await supabase
        .from('tenants')
        .update({
          google_calendar_refresh_token: tokens.refresh_token || null,
        })
        .eq('id', parsedTenantId);

      if (error) throw error;
      return NextResponse.redirect(new URL('/settings?calendar_connected=true', req.url));
    }

  } catch (error: any) {
    console.error('Google OAuth Callback Error:', error.message);
    return NextResponse.redirect(new URL('/team?calendar_error=true', req.url));
  }
}
