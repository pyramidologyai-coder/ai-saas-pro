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

export default function middleware(req: NextRequest) {
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

  // 10,000-Year Hacker Defense: The Master Vault (Edge Protection)
  // If someone tries to access /super-admin, we check for a highly secure Edge Cookie
  if (url.pathname.startsWith('/super-admin')) {
    // To enter the vault for the first time, Master Admin must append ?vault_key=SECRET
    const vaultKeyParam = url.searchParams.get('vault_key');
    const masterSecret = process.env.MASTER_VAULT_KEY || 'default-secret-change-me';
    
    if (vaultKeyParam === masterSecret) {
      // Correct key provided! We generate a response that sets the cookie
      const response = NextResponse.redirect(new URL('/super-admin', req.url));
      response.cookies.set('master_vault_token', masterSecret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 // 24 hours
      });
      return response;
    }

    // Check if the cookie already exists
    const vaultCookie = req.cookies.get('master_vault_token');
    if (vaultCookie?.value !== masterSecret) {
      // Intruder detected! Do not redirect to login, return a stealth 404 to hide the route's existence.
      console.warn(`[SECURITY TRIPWIRE] Unauthorized access attempt to /super-admin from IP: ${req.headers.get('x-forwarded-for') || 'Unknown'}`);
      url.pathname = '/404'; // Stealth hide
      return NextResponse.rewrite(url);
    }
  }

  // If it's the main domain, a vercel preview domain, or an API route, just let it pass
  if (
    hostname === 'localhost:3000' ||
    hostname === 'aisaaspro.com' ||
    hostname === 'www.aisaaspro.com' ||
    hostname.endsWith('.vercel.app') ||
    url.pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // If it's a custom domain or a subdomain, rewrite to dynamic route
  // e.g. "myclinic.com" -> "/_sites/myclinic.com"
  url.pathname = `/_sites/${currentHost}${url.pathname}`;
  
  return NextResponse.rewrite(url);
}
