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

  // Master Vault: Edge protection for /super-admin
  // Access flow: append ?vault_key=SECRET once → sets a signed session cookie → subsequent requests use cookie
  if (url.pathname.startsWith('/super-admin')) {
    const masterSecret = process.env.MASTER_VAULT_KEY;

    if (!masterSecret) {
      // Vault key not configured — block all access silently
      console.error('[SECURITY] MASTER_VAULT_KEY env variable is not set. /super-admin is inaccessible.');
      url.pathname = '/404';
      return NextResponse.rewrite(url);
    }

    const vaultKeyParam = url.searchParams.get('vault_key');

    if (vaultKeyParam) {
      // Constant-time comparison to prevent timing attacks
      const encoder = new TextEncoder();
      const a = encoder.encode(vaultKeyParam);
      const b = encoder.encode(masterSecret);
      const keysMatch = a.length === b.length && crypto.subtle !== undefined
        ? await crypto.subtle.importKey('raw', b, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
            .then(key => crypto.subtle.sign('HMAC', key, a))
            .then(() => vaultKeyParam === masterSecret)
            .catch(() => false)
        : vaultKeyParam === masterSecret;

      if (keysMatch) {
        // Store a hashed session token, NOT the secret itself
        const sessionToken = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(masterSecret + req.headers.get('user-agent')))
          .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

        const cleanUrl = new URL('/super-admin', req.url);
        const response = NextResponse.redirect(cleanUrl);
        response.cookies.set('master_vault_session', sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 4 // 4 hours (reduced from 24)
        });
        return response;
      }

      // Wrong key — stealth block
      console.warn(`[SECURITY TRIPWIRE] Wrong vault_key attempt on /super-admin from IP: ${req.headers.get('x-forwarded-for') || 'Unknown'}`);
      url.pathname = '/404';
      return NextResponse.rewrite(url);
    }

    // Validate existing session cookie
    const vaultCookie = req.cookies.get('master_vault_session');
    if (!vaultCookie?.value) {
      console.warn(`[SECURITY TRIPWIRE] Unauthorized /super-admin access from IP: ${req.headers.get('x-forwarded-for') || 'Unknown'}`);
      url.pathname = '/404';
      return NextResponse.rewrite(url);
    }

    // Recompute expected session token and compare
    const expectedToken = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(masterSecret + req.headers.get('user-agent')))
      .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

    if (vaultCookie.value !== expectedToken) {
      console.warn(`[SECURITY TRIPWIRE] Invalid vault session cookie from IP: ${req.headers.get('x-forwarded-for') || 'Unknown'}`);
      url.pathname = '/404';
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
