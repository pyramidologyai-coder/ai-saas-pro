/**
 * A single shared password for the dashboard.
 *
 * This is a GATE, not an identity system. Everyone who knows the password sees
 * every tenant's dashboard. That is fine while you drive the demo yourself.
 * Before a real customer logs in on their own, this must become per-tenant
 * accounts backed by Supabase Auth and the RLS policies already in the schema.
 *
 * The cookie holds a hash, never the password. httpOnly, so page scripts can't
 * read it.
 */

export const AUTH_COOKIE = "automology_auth";

/** SHA-256 hex. Works in both the Edge runtime and Node. */
export async function tokenFor(secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(`automology:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-independent comparison, so timing doesn't leak the value. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
