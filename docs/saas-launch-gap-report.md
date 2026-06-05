# Automology.ai SaaS Launch Gap Report

**Product:** AI SaaS Clinics & Restaurants  
**Repo HEAD:** `b8133e23854496ac5cd52f8dddf63c17be093819` (`b8133e2 Hardening tenant API key management`)  
**Report date:** 2026-06-05  
**Scope:** Final launch-gap classification after push and Vercel auto-deploy. This report is an audit document only; no production code, database, env, Stripe, Meta, Vercel, or GitHub changes were performed.

## 1. Executive Summary

**Verified:** The local repo is on `master` at `b8133e23854496ac5cd52f8dddf63c17be093819`, matching the Hermes-provided deployed commit. `git status -sb` showed `## master...origin/master` before this report was written.

**Claimed by Hermes:** `git push origin master` succeeded, Vercel auto-deploy reached Ready, production home returned HTTP 200, `/api/health` returned HTTP 200 JSON `status: ok`, and `npm.cmd run build` passed locally before push.

**Verified:** The application contains meaningful hardening for protected dashboard routes, public chat token binding, Meta webhook signature verification, Stripe webhook signature verification, tenant-scoped API-key booking endpoints, service-role containment in server-only helpers, and staff role validation.

**Not production-ready:** The product should not be called fully production-ready. The controlled MVP launch is still blocked by unexecuted Supabase migrations, unverified runtime secrets, unverified live DB schema/RLS state, and incomplete post-deploy workflow smoke testing.

## 2. Verified Completed Items

- **Verified:** Protected dashboard routes are listed and guarded in `src/proxy.ts:13-31`, with `supabase.auth.getUser()` required for protected paths at `src/proxy.ts:138-140`.
- **Verified:** `/master-admin` requires `verify_master_admin_role()` at `src/proxy.ts:142-145`; `/agency-admin` requires an agency row owned by the authenticated user at `src/proxy.ts:148-155`.
- **Verified:** Custom-domain public pages use `server-only` and the service-role helper at `src/app/_sites/[domain]/page.tsx:1-16`, fetch only active tenant records by `custom_domain` at `src/app/_sites/[domain]/page.tsx:17-22`, and tenant-scope public services at `src/app/_sites/[domain]/page.tsx:31-36`.
- **Verified:** Public chat token issuance requires a trusted host and active tenant at `src/app/api/chat/token/route.ts:17-23` and `src/app/api/chat/token/route.ts:50-59`.
- **Verified:** Public chat tokens are HMAC signed, bound to tenant/host/expiry, and verified with timing-safe comparison at `src/lib/public-chat-token.ts:58-98` and `src/lib/public-chat-token.ts:100-135`.
- **Verified:** `/api/chat` validates tenant ID, public token, host/domain, tenant status, quota, and message length before invoking AI at `src/app/api/chat/route.ts:35-75` and `src/app/api/chat/route.ts:79-123`.
- **Verified:** External booking API keys are hashed and looked up by `tenant_api_keys.key_hash` at `src/lib/external-api-auth.ts:179-187`, require active status/scopes at `src/lib/external-api-auth.ts:197-209`, and verify tenant status at `src/lib/external-api-auth.ts:211-225`.
- **Verified:** `/api/v1/bookings` creates and reads bookings only after `authenticateExternalApiRequest` and writes/reads with tenant scope at `src/app/api/v1/bookings/route.ts:153-189` and `src/app/api/v1/bookings/route.ts:207-219`.
- **Verified:** Manual dashboard booking creation checks bearer auth and verifies tenant ownership/profile access before insert at `src/app/api/bookings/route.ts:9-18` and `src/app/api/bookings/route.ts:28-48`.
- **Verified:** Booking delete uses object-level authorization before deleting at `src/app/api/bookings/[id]/route.ts:7-24` and `src/app/api/bookings/[id]/route.ts:32-52`.
- **Verified:** Meta webhook GET uses `META_VERIFY_TOKEN` at `src/app/api/webhooks/meta/route.ts:12-28`; POST requires `x-hub-signature-256` and HMAC verification with `META_APP_SECRET` at `src/app/api/webhooks/meta/route.ts:34-56`.
- **Verified:** Stripe webhook requires `stripe-signature`, webhook secret, and `stripe.webhooks.constructEvent` before trusting event data at `src/app/api/webhooks/stripe/route.ts:9-40`.
- **Verified:** Checkout requires user bearer auth and tenant ownership before creating Stripe Checkout at `src/app/api/checkout/route.ts:16-38`.
- **Verified:** Service-role client creation is server-only and lazy-initialized in `src/lib/supabase-admin.ts:1-27`.
- **Verified:** Staff creation blocks privileged platform roles and restricts tenant-admin assignment through validation at `src/lib/staff-roles.ts:1-12` and `src/lib/staff-roles.ts:46-72`.
- **Verified:** Cron endpoints call `authorizeCronRequest` at `src/app/api/cron/reminders/route.ts:7-10` and `src/app/api/cron/notifications/route.ts:8-10`; the helper requires `CRON_SECRET` and constant-time bearer comparison at `src/lib/cron-auth.ts:33-59`.
- **Verified:** Dependency versions include patched-current-looking `next@16.2.4`, `react@19.2.4`, and `react-dom@19.2.4` in `package.json`.

## 3. P0 Blockers Before Safe/Controlled MVP Launch

1. **Supabase migrations are not executed.**  
   **Status:** Claimed by Hermes and supported by repo docs.  
   **Evidence:** `docs/mvp-completion-roadmap.md:19-24`, `docs/tenant-isolation-audit.md:19`, and `supabase/migrations/README.md:5` state migrations/database execution remain gated.  
   **Risk:** Production schema/RLS may not match code assumptions. Routes depending on `tenant_api_keys`, `tenant_api_key_events`, `tenants.api_key_hash`, staff RLS, billing columns, wallet ledger, or hardened master-admin helpers can fail or expose/overgrant data depending on live DB state.

2. **Runtime secrets have not been verified after deployment.**  
   **Status:** Claimed by Hermes; repo evidence confirms multiple hard dependencies.  
   **Evidence:** AI uses `GEMINI_API_KEY` at module scope and warns AI features crash if missing at `src/lib/ai-agent.ts:4-9`; BI agent explicitly returns 503 if missing at `src/app/api/bi/agent/route.ts:270-276`; public chat requires `PUBLIC_CHAT_TOKEN_SECRET` at `src/app/api/chat/token/route.ts:22-23`; cron requires `CRON_SECRET` at `src/lib/cron-auth.ts:33-39`; WhatsApp requires Meta token/phone ID at `src/lib/whatsapp.ts:1-8`; Stripe requires KMS/env secrets at `src/app/api/webhooks/stripe/route.ts:16-30`.  
   **Risk:** Public AI/chat/WhatsApp/billing/cron flows can fail in production even though `/api/health` is green.

3. **Database preflight and rollback are not approved/executed.**  
   **Status:** Verified from migration README.  
   **Evidence:** Required preflight includes table existence, RLS enabled, public widget compatibility, master admin app metadata, API-key hash backfill, and backup at `supabase/migrations/README.md:37-47`; rollback requires backup/snapshot and reviewed environment-specific SQL at `supabase/migrations/README.md:48-50`.  
   **Risk:** Running migrations without live-schema verification could break public widgets, staff access, billing, or admin access.

4. **Post-deploy workflow validation is incomplete.**  
   **Status:** Claimed by Hermes; assumed incomplete because only home and health checks were reported.  
   **Evidence:** MVP workflow checklist requires auth, onboarding, settings, bookings, staff, master admin, agency admin, public custom domain, and API-key booking tests at `docs/mvp-completion-roadmap.md:117-132`.  
   **Risk:** The deployment can be HTTP-healthy while core SaaS workflows are broken.

## 4. P1 Blockers Before Paid/Public Launch

1. **Billing is not financially production-complete.**  
   **Verified:** Checkout and webhook have security controls, but plan pricing is DB/default based at `src/app/api/checkout/route.ts:49-56`, Paymob is explicitly pending at `src/app/api/checkout/route.ts:113-117`, and webhook writes invoices/wallet ledger that require live schema readiness at `src/app/api/webhooks/stripe/route.ts:107-134`.  
   **Risk:** Mispriced subscriptions, incomplete payment options, or failed invoice/ledger writes.

2. **Agency/white-label hierarchy is partially implemented but not fully launch-proven.**  
   **Verified:** Agency admin route gating exists in `src/proxy.ts:148-155`; Stripe Connect agency destination charges exist at `src/app/api/checkout/route.ts:79-93`; `stripe_account_id` migration exists at `supabase/migrations/supabase-migrations-stripe-connect.sql:1-6`.  
   **Risk:** Agency commissions, payout accountability, tenant assignment, and white-label operational flows remain unsafe for broad public/paid rollout until tested end to end.

3. **Public chat rate limiting is in-memory.**  
   **Verified:** `/api/chat` uses a module-level `Map` at `src/app/api/chat/route.ts:16-33`.  
   **Risk:** This does not coordinate across Vercel instances/regions and can reset on cold starts. Acceptable for controlled MVP if documented, not enough for public abuse resistance.

4. **AI safety and cost controls need production telemetry.**  
   **Verified:** Message truncation/quota checks exist in `/api/chat` at `src/app/api/chat/route.ts:42-54` and `src/app/api/chat/route.ts:108-123`, and WhatsApp webhook truncates oversized input at `src/app/api/webhooks/meta/route.ts:89-94`.  
   **Risk:** No verified spend dashboard, per-tenant hard billing enforcement, or model-failure monitoring was validated in this task.

5. **Cron scheduling mismatch needs review.**  
   **Verified:** `vercel.json:2-6` schedules only `/api/cron/reminders` daily at midnight, while code comments say hourly at `src/app/api/cron/reminders/route.ts:6`. `/api/cron/notifications` exists but is not scheduled in `vercel.json`.  
   **Risk:** Reminder/follow-up behavior may not match product expectations.

## 5. P2 / V1 / V2 Items That Should Not Block Controlled MVP

- Full white-label agency resale program and custom subdomain automation.
- Multi-product Automology subdomain architecture (`www`, `app`, `agents`, product-specific subdomains).
- Turborepo migration and package extraction for UI/auth/database/AI/billing/messaging/config.
- Voice AI agents, voice notes, STT/TTS, and call center workflows.
- Omnichannel expansion beyond current WhatsApp/web chat foundations: Instagram, Messenger, Telegram, Snapchat, TikTok, LinkedIn.
- Advanced analytics/BI, revenue forecasting, and executive dashboards beyond MVP validation.
- Enterprise SSO, audit exports, compliance programs, and WAF/rate-limit hardening.

## 6. Route/API Inventory Summary

**Page routes discovered:** `/`, `/auth`, `/onboarding`, `/_sites/[domain]`, plus dashboard routes for `/admin`, `/agency-admin`, `/billing`, `/bookings`, `/branches`, `/customers`, `/marketing`, `/messages`, `/profile`, `/reports`, `/services`, `/settings`, `/team`, `/users`, `/wallet`, and master-admin subroutes for agencies, clients, finance, logs, marketing, messages, overview, plans, settings, wallet.

**Protected-route concern:** Proxy protection is verified for the dashboard route list at `src/proxy.ts:13-31`, but route-level authorization still matters because middleware/proxy is not a sufficient sole authorization boundary. Representative route-level checks exist for bookings, checkout, staff, and webhooks.

| API route | Methods | Verified concern |
|---|---:|---|
| `src/app/api/agencies/activate/route.ts` | POST | Auth/tenant checks detected; needs live role smoke test. |
| `src/app/api/agencies/suspend/route.ts` | POST | Auth/tenant checks detected; needs live role smoke test. |
| `src/app/api/bi/agent/route.ts` | POST | Requires `GEMINI_API_KEY`; missing env returns/causes AI failure risk. |
| `src/app/api/bi/metrics/route.ts` | GET | Auth/tenant checks detected; verify tenant filtering live. |
| `src/app/api/bi/verify/route.ts` | GET | Auth checks detected. |
| `src/app/api/bookings/route.ts` | POST | Verified bearer auth and tenant/profile access checks. |
| `src/app/api/bookings/[id]/route.ts` | DELETE | Verified object-level booking authorization. |
| `src/app/api/calendar/auth/route.ts` | POST | Auth/tenant checks detected; OAuth env/config not validated. |
| `src/app/api/calendar/callback/route.ts` | GET | Auth/tenant checks detected; OAuth callback not live-tested. |
| `src/app/api/chat/token/route.ts` | GET | Public by design; host/tenant/signing-secret gated. |
| `src/app/api/chat/route.ts` | POST | Public token + tenant/domain + quota checks verified. |
| `src/app/api/checkout/route.ts` | POST | User/tenant ownership verified; billing env/schema unverified. |
| `src/app/api/cron/notifications/route.ts` | GET | Cron bearer auth verified; not scheduled in `vercel.json`. |
| `src/app/api/cron/reminders/route.ts` | GET | Cron bearer auth verified; schedule may be too sparse. |
| `src/app/api/health/route.ts` | GET | Public health check; returns DB/Meta status, but reports Redis queue as mocked at `src/app/api/health/route.ts:46-51`. |
| `src/app/api/master-admin/analytics/route.ts` | GET | Auth detected; live master-admin validation needed. |
| `src/app/api/staff/create/route.ts` | POST | Verified tenant owner access and role validation. |
| `src/app/api/staff/delete/route.ts` | POST | Auth/tenant checks detected; live destructive action test should use staging only. |
| `src/app/api/staff/update/route.ts` | POST | Auth/tenant checks detected. |
| `src/app/api/v1/bookings/route.ts` | GET/POST | Verified hashed API-key auth and tenant-scoped queries. |
| `src/app/api/webhooks/meta/route.ts` | GET/POST | Verified Meta token/signature checks. |
| `src/app/api/webhooks/stripe/route.ts` | POST | Verified Stripe signature checks. |
| `src/app/auth/callback/route.ts` | GET | Auth callback detected; smoke-test required. |

## 7. Supabase Migration Readiness

**Verified:** Migration README says do not run production migrations until order, preflight, rollback, and environment readiness are approved at `supabase/migrations/README.md:5`.

**Key remediation sequence documented:** `supabase-migrations-master-rbac-fix.sql`, `supabase-migrations-dynamic-admin-role.sql`, `supabase-migrations-api-key-hashing.sql`, `supabase-migrations-ai-dialect.sql`, `supabase-migrations-migrate-profiles-permissions.sql`, `supabase-migrations-staff-rls-access.sql`, `supabase-migrations-drop-public-rls.sql`, `supabase-migrations-bookings-fk.sql` at `supabase/migrations/README.md:13-35`.

**Important additional migration files discovered:** `20260604_replace_unsafe_master_admin_rls.sql`, `20260604201326_create_tenant_api_keys.sql`, `supabase-migrations-stripe-connect.sql`, `supabase-migrations-wallet-ledger.sql`, `supabase-migrations-webhook-invoices.sql`, `supabase-migrations-whatsapp-templates.sql`, `supabase-migrations-whitelabel.sql`, and many historical `supabase-migrations-*.sql` files.

**Execution blockers:**

- Confirm live schema has all required tables/columns before applying any migration.
- Confirm `public.is_master_admin()` exists before `20260604_replace_unsafe_master_admin_rls.sql`; the migration raises if missing at `supabase/migrations/20260604_replace_unsafe_master_admin_rls.sql:7-13`.
- Confirm master-admin users have trusted app metadata, not user metadata. Prior unsafe hardcoded email policy exists in historical migration evidence at `supabase/migrations/supabase-migrations-security-rls.sql:11-16`.
- Confirm `tenant_api_keys` migration order and app code deployment order. The table is required by current API auth at `src/lib/external-api-auth.ts:183-187`; the migration is draft-only and requires `tenants`, `profiles`, and `is_master_admin()` at `supabase/migrations/20260604201326_create_tenant_api_keys.sql:1-17` and `supabase/migrations/20260604201326_create_tenant_api_keys.sql:19-33`.
- Confirm public flows no longer need anonymous table access before applying `supabase-migrations-drop-public-rls.sql`; this is called out at `supabase/migrations/README.md:31-33` and `supabase/migrations/README.md:41-43`.
- Take backup/snapshot before execution at `supabase/migrations/README.md:46`.

## 8. Public Booking / Message / Widget Readiness

**Verified ready foundations:**

- Custom-domain page is server-only and tenant-scoped.
- Public chat has token issuance and verification bound to host/tenant/expiry.
- Public chat writes AI-created bookings with verified `tenantId` after token/domain checks at `src/app/api/chat/route.ts:126-143`.
- External booking API uses hashed tenant API keys and scoped tenant inserts/reads.

**Remaining P0/P1 gaps:**

- **P0:** Verify `PUBLIC_CHAT_TOKEN_SECRET` exists in production runtime before enabling public widget traffic.
- **P0:** Verify live DB has `tenant_api_keys`/events migration applied before relying on `/api/v1/bookings`.
- **P1:** Replace or augment in-memory public chat rate limiting with shared rate limiting before public/paid rollout.
- **P1:** Run live tests for custom domain routing, token issuance, chat send, AI booking creation, and booking readback.

## 9. AI / WhatsApp Readiness

**Verified:** AI agent uses `GEMINI_API_KEY` and initializes Gemini at module scope with a dummy fallback at `src/lib/ai-agent.ts:4-9`, then uses `gemini-2.5-flash` at `src/lib/ai-agent.ts:112-115`. Missing key warning aligns with Hermes' build warning.

**Verified:** `/api/chat` and Meta webhook both route messages through `processIncomingMessage` at `src/app/api/chat/route.ts:127-133` and `src/app/api/webhooks/meta/route.ts:170`.

**Verified:** WhatsApp sender requires `META_ACCESS_TOKEN` or a tenant token and phone number ID at `src/lib/whatsapp.ts:1-8`.

**Verified:** Meta webhook signature protection exists and blocks missing/invalid signatures.

**P0:** Confirm `GEMINI_API_KEY`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, and tenant `meta_token`/`whatsapp_number_id` state in runtime and DB without exposing values.

**P1:** Validate one sandbox WhatsApp inbound/outbound cycle, one AI fallback case, one quota-exceeded case, and one suspended-tenant case.

## 10. Billing / Stripe Readiness

**Verified:** Checkout authenticates a user, verifies tenant ownership, reads pricing server-side, and creates Stripe Checkout with tenant metadata.

**Verified:** Stripe webhook verifies signature before processing, validates tenant ID format, checks idempotency by invoice ID, updates tenant subscription status, inserts invoice, and attempts wallet ledger insert.

**P0:** Confirm required Stripe/KMS/env secrets are configured and accessible in production runtime.

**P1:** Confirm migrations/columns for invoices, wallet ledger, agency payments, Stripe Connect, and platform settings exist in live DB.

**P1:** Run Stripe test-mode end-to-end checkout, webhook replay/idempotency, cancellation/refund, and agency Connect destination charge validation before paid/public launch.

## 11. Agency / Master-Admin / Tenant / Staff Hierarchy Gaps

**Verified:** Dashboard proxy gates master-admin and agency-admin paths.

**Verified:** Staff API creation requires authenticated tenant owner access at `src/app/api/staff/create/route.ts:44-55`, blocks privileged roles at `src/lib/staff-roles.ts:56-58`, and limits tenant admin assignment rules at `src/lib/staff-roles.ts:64-69`.

**Gaps:**

- **P0:** Live DB must contain trusted `raw_app_meta_data.role = 'master_admin'` for Ahmad/master admins before master-admin RLS migration execution.
- **P1:** Staff permissions and RLS must be smoke-tested per role after migrations.
- **P1:** Agency tenant ownership, commission settings, Stripe Connect routing, and tenant suspension/reactivation need end-to-end tests.
- **P2:** Full agency white-label/self-service resale should remain V1/V2 until current MVP is stable.

## 12. Deployment Status and Remaining Post-Deploy Validation

**Claimed by Hermes:** Vercel auto-deploy is Ready at `https://reportclinics-frdp45bjy-pyramidologyai-4668s-projects.vercel.app`; aliases include `https://reportclinics.vercel.app` and `https://reportclinics-pyramidologyai-4668s-projects.vercel.app`; production `/` and `/api/health` returned HTTP 200.

**Verified locally:** HEAD is `b8133e23854496ac5cd52f8dddf63c17be093819`; package versions are modern; health endpoint code checks DB and Meta but includes a mocked Redis queue status at `src/app/api/health/route.ts:46-51`.

**Remaining validation before controlled MVP:**

1. Verify production env presence for required secrets without printing values.
2. Verify `/auth` login/callback and protected-route redirects.
3. Verify owner onboarding and tenant creation/update.
4. Verify services, branches, bookings, customers, messages, team, settings, billing dashboards.
5. Verify staff create/update/delete with role boundaries.
6. Verify master-admin and agency-admin role gates.
7. Verify public custom-domain page and public chat token/chat flow.
8. Verify `/api/v1/bookings` with a newly created tenant API key after migrations.
9. Verify Meta webhook GET challenge and signed POST using sandbox/test payload.
10. Verify Stripe test checkout and webhook.

## 13. Next Recommended Approval Sequence for Ahmad

1. **Ahmad approval:** Allow read-only production/Vercel env presence verification. No secret values printed or changed.
2. **Ahmad approval:** Allow Supabase live-schema read-only preflight: tables, columns, policies, functions, master-admin app metadata, and migration history.
3. **Hermes review:** Approve exact migration order and rollback/backup checklist.
4. **Ahmad approval:** Take backup/snapshot and run approved Supabase migrations in a controlled window.
5. **Hermes review:** Verify post-migration RLS/policy/function state and API schema dependencies.
6. **Ahmad approval:** Run controlled MVP smoke tests against production deployment.
7. **Hermes gate:** Approve limited MVP launch only if P0 items are closed; defer P1 items for paid/public launch gate.

## Classification Summary

**P0 before controlled MVP:** execute/verify Supabase migrations after approval; verify runtime env; run DB preflight/backup/rollback; run core post-deploy smoke tests.

**P1 before paid/public:** Stripe/agency billing end-to-end; shared rate limiting; role/RLS regression suite; cron schedule alignment; WhatsApp sandbox validation; AI cost/usage telemetry.

**P2 later:** omnichannel expansion, voice AI, full white-label agency program, Turborepo migration, shared platform extraction, enterprise compliance.
