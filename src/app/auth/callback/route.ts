import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  try {
    if (code) {
      const supabase = await createClient();
      
      // Synchronously exchange the authorization code for a session on the server
      // This automatically sets the session cookies on the response headers.
      await supabase.auth.exchangeCodeForSession(code);
      
      // Retrieve the authenticated user to determine the role and proper landing dashboard
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (user && !userError) {
        let isMaster = false;
        try {
          // Verify if master admin
          const { data } = await supabase.rpc('verify_master_admin_role');
          if (data) {
            isMaster = true;
          } else {
            const { data: fallbackData } = await supabase.rpc('is_master_admin');
            isMaster = !!fallbackData;
          }
        } catch (e) {
          // Ignore
        }

        const role = user.user_metadata?.role;
        let isAgency = role === 'super_admin';

        if (!isMaster && !isAgency) {
          // Query the agencies table
          const { data: agencyRow } = await supabase
            .from('agencies')
            .select('id')
            .eq('user_id', user.id)
            .limit(1);
          isAgency = !!(agencyRow && agencyRow.length > 0);
        }

        // Perform server-side redirects to appropriate dashboard routes
        if (isMaster) {
          return NextResponse.redirect(new URL('/master-admin', request.url));
        } else if (isAgency) {
          return NextResponse.redirect(new URL('/agency-admin', request.url));
        } else {
          return NextResponse.redirect(new URL('/admin', request.url));
        }
      }
    }
  } catch (error) {
    console.error('OAuth Callback Exception:', error);
  }

  // Fallback redirect to auth page on missing authorization code or errors
  return NextResponse.redirect(new URL('/auth', request.url));
}
