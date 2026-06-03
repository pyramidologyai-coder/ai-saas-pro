# Automology.ai MVP Completion Roadmap

**Product:** AI SaaS Clinics & Restaurants  
**Purpose:** Define what “finished enough to launch safely” means for the first Automology.ai SaaS product.  
**Gatekeeper rule:** Completion means secure, sellable, operable, and deployable — not feature-complete forever.

---

## Current Gatekeeper Status

### Completed in repo

- Dashboard/admin middleware hardening.
- Git migration-file cleanup.
- Reviewed Supabase remediation migration files committed.
- Tenant-isolation audit document updated.
- Custom-domain public site reads moved to server-only service-role access so public RLS can be closed.

### Still blocked

- Supabase migrations have not been executed.
- Production database has not been touched.
- Production deployment has not been approved.
- AI features still require verified `GEMINI_API_KEY` configuration in the runtime environment.

---

## MVP Launch Definition

The first Automology.ai product is MVP-ready when these areas are verified:

1. **Authentication and dashboard protection**
   - Protected dashboard routes redirect unauthenticated users to auth.
   - Master admin routes require master-admin metadata.
   - Agency admin routes require agency ownership.
   - Tenant dashboard routes cannot be accessed cross-tenant.

2. **Tenant isolation and RLS**
   - Unsafe public table policies removed.
   - Staff policies scoped by tenant and granular permissions.
   - Service-role access only exists in server-only routes/actions.
   - API routes validate tenant context before writes.

3. **Database migration readiness**
   - Migration order approved.
   - Production backup/snapshot available.
   - Preflight checks pass.
   - Rollback strategy documented.

4. **Core customer workflow**
   - Signup/login works.
   - Onboarding creates/updates tenant correctly.
   - Owner can configure business settings.
   - Services/items can be created and displayed.
   - Branches can be created and displayed.
   - Bookings can be created, listed, updated, and deleted as intended.
   - Customers/messages views show tenant-scoped data only.

5. **Staff/team workflow**
   - Admin can create staff.
   - Staff profiles get correct tenant ID and permissions.
   - Staff cannot access other tenants.
   - Staff cannot perform actions beyond assigned permission keys.

6. **Public website/widget workflow**
   - Custom-domain site shows only active tenant public data.
   - Public booking/message flows use server-side validation.
   - Public flows do not require anonymous table-level RLS access.
   - Spam/rate-limit protections exist or are explicitly accepted as post-MVP.

7. **AI/WhatsApp workflow**
   - AI environment variables are configured.
   - WhatsApp webhook receives and scopes messages to correct tenant.
   - AI booking creation writes only to verified tenant.
   - AI failures degrade gracefully without cross-tenant leakage.

8. **Billing and plan enforcement**
   - Trial/plan states are represented.
   - Suspended tenants cannot use protected paid functionality.
   - Upgrade path is clear enough for first customers.

9. **Operational readiness**
   - Build passes.
   - Git is clean.
   - Required env vars are present without exposing values.
   - Error logs do not leak secrets.
   - Deployment path is documented.

---

## Immediate Next Work Packages

### Package A — Supabase execution readiness

Goal: prepare a safe migration execution decision.

Tasks:

- Verify production/staging schema against the committed migrations.
- Confirm master admin metadata exists.
- Confirm public widget/customer flows do not depend on direct anonymous table access.
- Prepare exact SQL execution order.
- Prepare rollback/backup checklist.

### Package B — Public booking/message hardening

Goal: make public customer interaction safe after public RLS removal.

Tasks:

- Locate all public/customer-facing booking and message entry points.
- Ensure inserts go through server-side route handlers/actions.
- Add tenant/domain validation.
- Add rate limiting/spam protection where feasible.
- Verify no direct anonymous Supabase inserts remain for public flows.

### Package C — MVP smoke test checklist

Goal: verify the product behaves like a sellable SaaS.

Tasks:

- Owner signup/login.
- Tenant onboarding.
- Business settings.
- Services/branches/team/bookings/customers/messages.
- Staff permission checks.
- Master admin overview.
- Agency admin overview.
- Public custom-domain page.
- API-key booking endpoint.

### Package D — Deployment gate

Goal: approve production deployment only after evidence.

Tasks:

- Build result.
- Git diff/log review.
- Migration execution evidence, if approved.
- Environment readiness check.
- Vercel/GitHub deployment status.
- Post-deploy smoke tests.

---

## Non-MVP / Later V1 Items

These should not block first controlled launch unless Ahmad chooses otherwise:

- Full white-label agency resale program.
- Advanced billing automation.
- Full omnichannel inbox beyond MVP WhatsApp/message needs.
- Voice AI receptionist.
- Advanced analytics/BI.
- Marketplace/integrations beyond the first required channels.
- Enterprise SSO/compliance features.

---

## Gatekeeper Recommendation

Do not add more broad features until Package A and Package B are closed. The next safest step is to verify database execution readiness and harden any remaining public booking/message flows before applying the public RLS removal migration.
