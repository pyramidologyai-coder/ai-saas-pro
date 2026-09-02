/**
 * Two ways in.
 *
 *   AUTH_COOKIE   — the master password. Sees every business. That's you.
 *   TENANT_COOKIE — a business's own access code. Sees only their dashboard.
 *
 * Cookies hold a hash, never the secret, and are httpOnly so page scripts
 * can't read them. Real per-user accounts with Supabase Auth come when
 * businesses need more than one login each.
 */

export const AUTH_COOKIE = "automology_auth";
export const TENANT_COOKIE = "automology_tenant";

/** SHA-256 hex. Works in the Edge runtime and in Node. */
export async function tokenFor(secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(`automology:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparison that doesn't leak the answer through timing. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Which slug a tenant cookie is for, if it's well formed. */
export function slugFromTenantCookie(v: string | undefined): string | null {
  if (!v) return null;
  const i = v.indexOf(":");
  return i > 0 ? v.slice(0, i) : null;
}

/**
 * The role in a tenant cookie. Older cookies were `slug:proof` with no role —
 * those read as owner, which is what they meant at the time.
 */
export function roleFromTenantCookie(v: string | undefined): string | null {
  if (!v) return null;
  const parts = v.split(":");
  return parts.length >= 3 ? parts[1] : "owner";
}
