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

/**
 * Which business this session may touch, and as what.
 *
 * Called by every route that accepts a slug in a request body. Middleware
 * cannot read a body, so this is the only place the two can be compared — and
 * without it a tenant session could name any slug it liked.
 */
export function sessionScope(req: { cookies: { get(name: string): { value: string } | undefined } }) {
  const master = Boolean(req.cookies.get(AUTH_COOKIE)?.value);
  const cookie = req.cookies.get(TENANT_COOKIE)?.value;
  return {
    master,
    slug: slugFromTenantCookie(cookie),
    role: master ? "owner" : (roleFromTenantCookie(cookie) ?? "viewer"),
  };
}

/** True if this session may act on that slug. Master may act on any. */
export function mayTouch(
  scope: { master: boolean; slug: string | null }, wanted: string | null | undefined,
): boolean {
  if (scope.master) return true;
  if (!scope.slug) return false;
  if (!wanted) return false;
  return scope.slug === wanted;
}

/* ── verified sessions ──────────────────────────────────────────────────────
 * The tenant cookie is `slug:role:sig`, and sig is an HMAC of `slug:role`
 * keyed by the master password — a secret only the server holds. It is checked
 * on every request.
 *
 * Before this it was not. The third segment was a hash of the access code that
 * nothing ever read back, so a browser could set `damai-clinic:owner:anything`
 * and be treated as the owner of any business, without ever knowing its code.
 * slugFromTenantCookie / roleFromTenantCookie / sessionScope above still parse
 * the cookie without checking it — they are kept only so older imports compile,
 * and must not be used to decide what a request may do. Use verifiedScope.
 *
 * Keying on DASHBOARD_PASSWORD means rotating it signs every tenant out, which
 * is a fair price for not carrying a second secret that could sit unset and
 * quietly leave every session forgeable.
 */
async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** The signature written into a tenant, agency or org cookie at login. */
export async function signSession(slug: string, role: string): Promise<string> {
  return hmacHex(process.env.DASHBOARD_PASSWORD ?? "", `sess:v1:${slug}:${role}`);
}

/** The trusted slug and role in a tenant cookie, or null if absent or forged. */
export async function verifiedTenant(
  cookie: string | undefined,
): Promise<{ slug: string; role: string } | null> {
  if (!cookie) return null;
  const first = cookie.indexOf(":");
  const second = cookie.indexOf(":", first + 1);
  if (first <= 0 || second <= first) return null;   // needs all three parts
  const slug = cookie.slice(0, first);
  const role = cookie.slice(first + 1, second);
  const sig = cookie.slice(second + 1);
  if (!slug || !role || !sig) return null;
  const expected = await signSession(slug, role);
  return safeEqual(sig, expected) ? { slug, role } : null;
}

/**
 * Who this request is, verified. Master is the checked master cookie; a tenant
 * is a cookie whose signature holds. Anyone else is nobody — slug and role come
 * back null and every guard fails closed. This is the only trustworthy reading
 * of a session; it replaces sessionScope, which trusted the cookie unchecked.
 */
export async function verifiedScope(
  req: { cookies: { get(name: string): { value: string } | undefined } },
): Promise<{ master: boolean; slug: string | null; role: string | null }> {
  const auth = req.cookies.get(AUTH_COOKIE)?.value;
  const master = process.env.DASHBOARD_PASSWORD;
  if (auth && master && safeEqual(auth, await tokenFor(master))) {
    return { master: true, slug: null, role: "owner" };
  }
  const t = await verifiedTenant(req.cookies.get(TENANT_COOKIE)?.value);
  return { master: false, slug: t?.slug ?? null, role: t?.role ?? null };
}
