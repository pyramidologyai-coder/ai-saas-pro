import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { GhostDefender } from './lib/ghost-defender';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

export default async function middleware(req: NextRequest) {
  // GHOST DEFENDER: Immediate inspection
  const trapResponse = GhostDefender.inspect(req);
  if (trapResponse) return trapResponse;

  const url = req.nextUrl;
  let res = NextResponse.next({
    request: req,
  });
  
  let hostname = req.headers.get('host') || 'localhost:3000';

  // Remove port for production
  if (hostname.includes(':') && !hostname.includes('localhost')) {
    hostname = hostname.split(':')[0];
  }

  const currentHost =
    process.env.NODE_ENV === 'production' && process.env.VERCEL === '1'
      ? hostname.replace(`.reportclinics.vercel.app`, '')
      : hostname.replace(`.localhost:3000`, '');

  // Create the modern @supabase/ssr server client for middleware/proxy cookie sync
  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => req.cookies.set(name, value));
          res = NextResponse.next({
            request: req,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // === GHOST DEFENDER: master-admin guard ===
  if (url.pathname.startsWith('/master-admin')) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.redirect(new URL('/auth', req.url));
    const { data: isMaster } = await supabase.rpc('verify_master_admin_role');
    if (!isMaster) return NextResponse.redirect(new URL('/auth', req.url));
  }

  // === GHOST DEFENDER: agency-admin guard ===
  if (url.pathname.startsWith('/agency-admin')) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.redirect(new URL('/auth', req.url));
    const { data: agencyData } = await supabase
      .from('agencies')
      .select('id')
      .eq('user_id', session.user.id)
      .single();
    if (!agencyData) return NextResponse.redirect(new URL('/auth', req.url));
  }

  // ✅ كل المسارات المحمية والداخلية
  const isExemptPath =
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/master-admin') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/agency-admin') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/onboarding') ||
    url.pathname.startsWith('/profile') ||
    url.pathname.startsWith('/billing') ||
    url.pathname.startsWith('/settings') ||
    url.pathname.startsWith('/wallet') ||
    url.pathname.startsWith('/messages') ||
    url.pathname.startsWith('/marketing') ||
    url.pathname.startsWith('/bookings') ||
    url.pathname.startsWith('/branches') ||
    url.pathname.startsWith('/customers') ||
    url.pathname.startsWith('/reports') ||
    url.pathname.startsWith('/services') ||
    url.pathname.startsWith('/team') ||
    url.pathname.startsWith('/users') ||
    url.pathname.startsWith('/automations');

  // ✅ الدومينات الأساسية
  const isMainDomain =
    hostname === 'localhost:3000' ||
    hostname === 'reportclinics.vercel.app' ||
    hostname.endsWith('.vercel.app');

  // ✅ لو على /admin وعنده session → check لو master admin وحوله
  if (url.pathname === '/admin' && isMainDomain) {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      const { data: isMaster } = await supabase.rpc('verify_master_admin_role');
      if (isMaster) {
        const redirectRes = NextResponse.redirect(new URL('/master-admin', req.url));
        // Copy the cookies set on `res` to the redirect response
        res.cookies.getAll().forEach(cookie => {
          redirectRes.cookies.set(cookie.name, cookie.value, {
            path: cookie.path,
            domain: cookie.domain,
            maxAge: cookie.maxAge,
            expires: cookie.expires,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            sameSite: cookie.sameSite,
          });
        });
        return redirectRes;
      }
    }
  }

  if (isMainDomain || isExemptPath) {
    return res;
  }

  // Custom domain → rewrite
  url.pathname = `/_sites/${currentHost}${url.pathname}`;
  const rewriteRes = NextResponse.rewrite(url);
  // Copy the cookies set on `res` to the rewrite response
  res.cookies.getAll().forEach(cookie => {
    rewriteRes.cookies.set(cookie.name, cookie.value, {
      path: cookie.path,
      domain: cookie.domain,
      maxAge: cookie.maxAge,
      expires: cookie.expires,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
    });
  });
  return rewriteRes;
}
