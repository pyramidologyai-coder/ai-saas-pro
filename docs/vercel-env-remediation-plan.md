# Vercel Environment Remediation Plan

**Product:** Automology.ai — AI SaaS Clinics & Restaurants  
**Date:** 2026-06-05  
**Scope:** Approval Next C — environment remediation plan only.  
**Restrictions followed:** No env changes, no secret values printed, no deploy, no DB writes, no code changes.

---

## 1. Executive Summary

Vercel Production has the core Supabase, Google Calendar, Gemini, CRON, and Resend variables present, but several variables referenced by production code are missing from the Vercel env list.

No env variables were added or modified.

---

## 2. Verified Present in Vercel Production

Observed via `vercel env ls`; values were encrypted and not printed.

- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `CRON_SECRET`
- `SUPER_ADMIN_EMAILS`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MASTER_VAULT_KEY`
- `NEXT_PUBLIC_SUPER_ADMIN_EMAILS`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `META_VERIFY_TOKEN`
- `DATABASE_ENCRYPTION_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`

---

## 3. Source Code Env References

Static source extraction found these env names:

- `CRON_SECRET` — `src/lib/cron-auth.ts`
- `DATABASE_ENCRYPTION_KEY` — `src/lib/kms.ts`
- `GEMINI_API_KEY` — `src/app/api/bi/agent/route.ts`, `src/lib/ai-agent.ts`
- `GOOGLE_CLIENT_ID` — `src/lib/googleCalendar.ts`
- `GOOGLE_CLIENT_SECRET` — `src/lib/googleCalendar.ts`
- `GOOGLE_REDIRECT_URI` — `src/lib/googleCalendar.ts`
- `META_ACCESS_TOKEN` — `src/lib/whatsapp.ts`
- `META_APP_SECRET` — `src/app/api/webhooks/meta/route.ts`
- `META_VERIFY_TOKEN` — `src/app/api/webhooks/meta/route.ts`
- `NEXT_PUBLIC_APP_URL` — chat and agency invite paths
- `NEXT_PUBLIC_BASE_URL` — `src/app/api/checkout/route.ts`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client/server helpers
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase client/server helpers
- `NODE_ENV` — runtime platform variable
- `PUBLIC_CHAT_TOKEN_SECRET` — `src/lib/public-chat-token.ts`
- `RESEND_API_KEY` — agency invitation email action
- `STRIPE_WEBHOOK_SECRET` — `src/app/api/webhooks/stripe/route.ts`
- `SUPABASE_SERVICE_ROLE_KEY` — `src/lib/supabase-admin.ts`
- `VERCEL` — runtime platform variable

---

## 4. Missing / Not Shown in Vercel Production

### P0 — `PUBLIC_CHAT_TOKEN_SECRET`

**Feature affected:** Public chat token signing/verification.  
**Code:** `src/lib/public-chat-token.ts`  
**Risk:** Public chat route/token flow can fail or become insecure if fallback behavior is not acceptable.  
**Action:** Add a strong random secret in Vercel Production and Preview if preview chat testing is needed.

### P0/P1 — `META_APP_SECRET`

**Feature affected:** Meta/WhatsApp webhook POST signature verification.  
**Code:** `src/app/api/webhooks/meta/route.ts`  
**Risk:** Webhook signature validation cannot be launch-grade without it.  
**Action:** Add Meta App Secret to Vercel Production.

### P1 — `META_ACCESS_TOKEN`

**Feature affected:** Global WhatsApp sending fallback in `src/lib/whatsapp.ts`.  
**Risk:** May be acceptable if all sending is tenant-token based; otherwise outbound WhatsApp can fail.  
**Action:** Decide whether this should exist globally or be tenant-scoped only. Prefer tenant-scoped encrypted token storage for multi-tenant platform.

### P0/P1 — `STRIPE_WEBHOOK_SECRET`

**Feature affected:** Stripe webhook signature verification.  
**Code:** `src/app/api/webhooks/stripe/route.ts`  
**Risk:** Billing webhook cannot be safely validated.  
**Action:** Add production or test-mode webhook secret depending on current billing environment.

### P1 — `NEXT_PUBLIC_BASE_URL`

**Feature affected:** Checkout route URL construction.  
**Code:** `src/app/api/checkout/route.ts`  
**Risk:** Checkout redirects may fail or point incorrectly if route does not fallback to `NEXT_PUBLIC_APP_URL`.  
**Action:** Either add it matching canonical app URL or update code later to standardize on `NEXT_PUBLIC_APP_URL`.

### P0/P1 — Stripe checkout keys not shown

Likely needed depending on active checkout implementation:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

**Risk:** Stripe checkout cannot work without these if billing is enabled.  
**Action:** Inspect Stripe checkout path before adding. Add only test-mode keys for test environment and live keys only before paid launch.

---

## 5. Manual Vercel Setup Checklist

Do not paste secret values into chat.

For each variable approved by Ahmad:

1. Open Vercel Dashboard.
2. Select project `reportclinics`.
3. Go to Settings → Environment Variables.
4. Add variable name exactly.
5. Choose correct environment: Production, and Preview if needed.
6. Paste value manually from secure source.
7. Save.
8. Redeploy only after explicit approval.

Recommended add order:

1. `PUBLIC_CHAT_TOKEN_SECRET`
2. `META_APP_SECRET`
3. `STRIPE_WEBHOOK_SECRET` if billing/webhooks are enabled
4. `STRIPE_SECRET_KEY` if checkout is enabled
5. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` if checkout frontend needs it
6. `NEXT_PUBLIC_BASE_URL` if checkout route currently requires it
7. `META_ACCESS_TOKEN` only if product decision is global Meta token; otherwise keep tenant-scoped.

---

## 6. Gatekeeper Recommendation

Do not change env variables until Ahmad confirms values are available and approves env changes explicitly.

Next approval should be limited to manual env setup or to code review of checkout/chat/Meta paths before env changes.
