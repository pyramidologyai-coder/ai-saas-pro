import { NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/googleCalendar';

import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { memberId, tenantId } = body;

    if (!tenantId) return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });

    // OBJECT-LEVEL AUTHORIZATION (Tenant)
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .eq('user_id', user.id)
      .single();

    if (!tenantData) {
       console.warn(`Ghost Defender: User ${user.id} attempted to hijack Google Auth for Tenant ${tenantId}`);
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // OBJECT-LEVEL AUTHORIZATION (Team Member)
    if (memberId) {
      const { data: memberData } = await supabase
        .from('team_members')
        .select('id')
        .eq('id', memberId)
        .eq('tenant_id', tenantId)
        .single();
        
      if (!memberData) {
         console.warn(`Ghost Defender: User ${user.id} attempted cross-tenant contamination on member ${memberId}`);
         return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const stateString = memberId ? `${tenantId}|${memberId}` : tenantId;
    const url = getGoogleAuthUrl(stateString);

    // SECURITY: Store the state in a secure HttpOnly cookie to prevent CSRF spoofing in the callback
    const response = NextResponse.json({ url });
    response.cookies.set('oauth_state', stateString, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
