# Automology Local Quality Sprint Report

Date: 2026-06-12  
Scope: Local code/test quality only. No DB writes, migrations, env changes, commits, pushes, or deploys.

## Analysis

The core dashboard, settings/account, auth guards, Master Agent, master-admin pages, and tracked API routes were reviewed statically. The production build is preserved. The highest-risk code issue was `/api/bi/metrics`: it authenticated the caller but did not authorize the requested tenant or agency, and it returned financial data with shared-cache headers.

## P0 Findings

- **Fixed:** `/api/bi/metrics` allowed authenticated callers to request arbitrary tenant/agency financial metrics. Added server-derived tenant, agency, manager-permission, and master-admin authorization.
- **Fixed:** `/api/bi/metrics` used `s-maxage` for user-specific financial responses. Replaced with `private, no-store` and `Vary: Authorization`.
- **Deferred approval gate:** Legacy tracked DB utility scripts contain unsafe master-role logic based on `user_metadata` / `raw_user_meta_data`, and `drop_constraint.js` references `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`. Do not run these scripts. Remove or quarantine them and rotate any exposed service-role credential only with explicit env/DB approval.

## P1 Findings

- **Fixed:** Dashboard routes relied on proxy plus client behavior for the shared auth gate. Added a server-side `getUser()` guard in the dashboard layout and preserved client session refresh in a dedicated shell.
- **Fixed:** `/admin/plans` rendered a master plan editor for any authenticated dashboard user. Added a server-side master-role RPC guard and removed the link from normal admin navigation.
- **Fixed:** `/admin/agency-plans` rendered a privileged agency editor for any authenticated dashboard user. Added server-side agency-owner/master authorization.
- **Fixed:** Identified API 500 responses leaked provider/database error messages. Replaced client responses with generic errors while retaining server logging.
- **Fixed:** Added bilingual dashboard loading and error fallbacks.

## P2 Findings

- `/api/health` publicly exposes uptime, latency, version, and service status; `redis_queue` is hard-coded as healthy. Restrict/detail-reduce before production monitoring is finalized.
- Many client pages use `getSession()` for UI decisions. This is acceptable only as UI state; RLS and server/API authorization must remain authoritative.
- `src/lib/tenant.ts` performs broad tenant selects and relies on RLS for isolation. Live RLS verification is required before pilot.
- In-memory rate limiters are per-process and unsuitable as the only production abuse control.
- No lint or automated test script is defined in `package.json`.
- The build warns that `GEMINI_API_KEY` is missing. No env change was made.

## Fixed Items

- Server-authenticated dashboard layout with preserved client shell behavior.
- Privileged plan editor route guards and normal-sidebar cleanup.
- BI metrics BOLA/tenant-scope fix, strict scope validation, user-scoped Supabase queries, and private caching.
- Generic external error responses for BI verification, checkout, and master analytics.
- Dashboard loading/error states.

## Testing Evidence

- `npx.cmd tsc --noEmit`: **PASS**
- `npm.cmd run build`: **PASS**; Next.js 16.2.9 production build completed and all routes generated.
- `npm.cmd audit --omit=dev --json` with `NODE_OPTIONS=--use-system-ca`: **FAIL (advisories present)**; 0 critical, 0 high, 2 moderate. Both trace to bundled `postcss <8.5.10` under `next`; npm reports no fix available.
- `git diff --check`: **PASS**
- ESLint: **NOT RUN**; `node_modules/.bin/eslint.cmd` is absent and no lint script is defined.
- Automated tests: **NOT RUN**; no test script is defined.
- Static source checks: master-admin pages all have server user/master-role checks; tracked `.env` files were not found; service-role/user-metadata legacy script risks recorded above.

## Files Affected

- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/loading.tsx`
- `src/app/(dashboard)/error.tsx`
- `src/app/(dashboard)/admin/plans/page.tsx`
- `src/app/(dashboard)/admin/agency-plans/page.tsx`
- `src/components/DashboardShell.tsx`
- `src/components/Sidebar.tsx`
- `src/app/api/bi/metrics/route.ts`
- `src/app/api/bi/verify/route.ts`
- `src/app/api/checkout/route.ts`
- `src/app/api/master-admin/analytics/route.ts`
- `src/lib/cognitive-engine.ts`
- `docs/automology-quality-sprint-report.md`

## Database Impact

No schema, RLS, migration, storage, Supabase project, or database write action was performed. The BI metrics route now uses the authenticated caller's Supabase client so existing RLS remains active.

## Rollback Strategy

Revert only the files listed above. No database or environment rollback is required.

## Remaining Risks

- Live DB/RLS policy verification remains mandatory for `tenants`, `profiles`, `agencies`, financial tables, views, RPCs, storage, and service-role paths.
- Legacy DB scripts remain a credential/authorization hazard until separately reviewed and quarantined.
- Dependency audit has two moderate findings without an npm-provided fix.
- No automated auth/tenant-isolation regression suite exists.

## Recommended Next Gate

Hermes code review, followed by an explicitly approved non-destructive Supabase/RLS verification gate and an authenticated local browser smoke test using test accounts for normal user, tenant admin, agency owner, and master admin.
