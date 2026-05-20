import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
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
  let hostname = req.headers.get('host') || 'localhost:3000';

  // Remove port for production
  if (hostname.includes(':') && !hostname.includes('localhost')) {
    hostname = hostname.split(':')[0];
  }

  const currentHost =
    process.env.NODE_ENV === 'production' && process.env.VERCEL === '1'
      ? hostname.replace(`.aisaaspro.com`, '')
      : hostname.replace(`.localhost:3000`, '');

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
    hostname === 'aisaaspro.com' ||
    hostname === 'www.aisaaspro.com' ||
    hostname === 'reportclinics.vercel.app' ||
    hostname.endsWith('.vercel.app');

  if (isMainDomain || isExemptPath) {
    return NextResponse.next();
  }

  // Custom domain → rewrite
  url.pathname = `/_sites/${currentHost}${url.pathname}`;
  return NextResponse.rewrite(url);
}
