import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { GhostDefender } from './lib/ghost-defender';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

export default async function middleware(req: NextRequest) {
  // GHOST DEFENDER: Immediate inspection of all incoming traffic
  const trapResponse = GhostDefender.inspect(req);
  if (trapResponse) return trapResponse;

  const url = req.nextUrl;
  
  // Get hostname of request (e.g. clinic.com, localhost:3000)
  let hostname = req.headers.get('host') || 'localhost:3000';

  // Remove port if exists for production domains
  if (hostname.includes(':') && !hostname.includes('localhost')) {
    hostname = hostname.split(':')[0];
  }

  // Define our base domains
  const currentHost =
    process.env.NODE_ENV === 'production' && process.env.VERCEL === '1'
      ? hostname.replace(`.aisaaspro.com`, '') // replace with your actual Vercel domain later
      : hostname.replace(`.localhost:3000`, '');



  // If it's the main domain, a vercel preview domain, or an API route, just let it pass
  if (
    hostname === 'localhost:3000' ||
    hostname === 'aisaaspro.com' ||
    hostname === 'www.aisaaspro.com' ||
    hostname.endsWith('.vercel.app') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/master-admin')
  ) {
    return NextResponse.next();
  }

  // If it's a custom domain or a subdomain, rewrite to dynamic route
  // e.g. "myclinic.com" -> "/_sites/myclinic.com"
  url.pathname = `/_sites/${currentHost}${url.pathname}`;
  
  return NextResponse.rewrite(url);
}
