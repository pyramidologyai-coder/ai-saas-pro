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

const PROTECTED_ROUTES = [
  '/admin',
  '/master-admin',
  '/agency-admin',
  '/profile',
  '/billing',
  '/settings',
  '/wallet',
  '/messages',
  '/marketing',
  '/bookings',
  '/branches',
  '/customers',
  '/reports',
  '/services',
  '/team',
  '/users',
  '/automations',
];

const APP_INTERNAL_ROUTES = [
  '/api',
  '/auth',
  '/onboarding',
  ...PROTECTED_ROUTES,
];

function startsWithRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

function copyResponseCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value, {
      path: cookie.path,
      domain: cookie.domain,
      maxAge: cookie.maxAge,
      expires: cookie.expires,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
    });
  });
}

function redirectWithCookies(req: NextRequest, res: NextResponse, pathname: string) {
  const redirectRes = NextResponse.redirect(new URL(pathname, req.url));
  copyResponseCookies(res, redirectRes);
  return redirectRes;
}

function redirectToAuth(req: NextRequest, res: NextResponse) {
  const authUrl = new URL('/auth', req.url);
  const nextPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;

  if (nextPath.startsWith('/') && !nextPath.startsWith('//')) {
    authUrl.searchParams.set('redirect', nextPath);
  }

  const redirectRes = NextResponse.redirect(authUrl);
  copyResponseCookies(res, redirectRes);
  return redirectRes;
}

export default async function middleware(req: NextRequest) {
  const trapResponse = GhostDefender.inspect(req);
  if (trapResponse) return trapResponse;

  const url = req.nextUrl;
  let res = NextResponse.next({
    request: req,
  });

  let hostname = req.headers.get('host') || 'localhost:3000';

  if (hostname.includes(':') && !hostname.includes('localhost')) {
    hostname = hostname.split(':')[0];
  }

  const currentHost =
    process.env.NODE_ENV === 'production' && process.env.VERCEL === '1'
      ? hostname.replace('.reportclinics.vercel.app', '')
      : hostname.replace('.localhost:3000', '');

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
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

  const pathname = url.pathname;
  const isProtectedPath = PROTECTED_ROUTES.some((route) => startsWithRoute(pathname, route));
  const isAppInternalPath = APP_INTERNAL_ROUTES.some((route) => startsWithRoute(pathname, route));
  const isPublicPath =
    pathname === '/' ||
    startsWithRoute(pathname, '/auth') ||
    isStaticAsset(pathname);
  const isMainDomain =
    hostname === 'localhost:3000' ||
    hostname === 'reportclinics.vercel.app' ||
    hostname.endsWith('.vercel.app');

  if (isProtectedPath) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirectToAuth(req, res);

    if (startsWithRoute(pathname, '/master-admin')) {
      const { data: isMaster } = await supabase.rpc('verify_master_admin_role');
      if (!isMaster) return redirectWithCookies(req, res, '/auth');
      return res;
    }

    if (startsWithRoute(pathname, '/agency-admin')) {
      const { data: agencyData } = await supabase
        .from('agencies')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!agencyData) return redirectWithCookies(req, res, '/auth');
      return res;
    }

    if (pathname === '/admin' && isMainDomain) {
      const { data: isMaster } = await supabase.rpc('verify_master_admin_role');
      if (isMaster) return redirectWithCookies(req, res, '/master-admin');
    }

    return res;
  }

  if (isPublicPath || isAppInternalPath || isMainDomain) {
    return res;
  }

  url.pathname = `/_sites/${currentHost}${pathname}`;
  const rewriteRes = NextResponse.rewrite(url);
  copyResponseCookies(res, rewriteRes);
  return rewriteRes;
}
