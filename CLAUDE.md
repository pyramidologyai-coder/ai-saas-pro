# Automology

An AI receptionist for small businesses. Multi-tenant SaaS: a clinic or salon
signs up, gets a branded page with an agent that answers customers, quotes real
prices, and books appointments into their diary.

Built by Tarek and one partner, evenings and weekends. Malaysia-based; most
customers are clinics and salons in KL.

---

## How to work on this

**Read `docs/` before changing anything.** `AUTOMOLOGY_STATUS_REPORT.html` says what is
built and — importantly — what has been written but never executed.
`AUTOMOLOGY_ARCHITECTURE_COMPLIANCE.html` maps everything against the platform spec, with
percentages weighted by what actually blocks a customer.

**Match the existing style.** Comments explain *why*, not *what*. Where a
decision was non-obvious, the reason is written down. Keep that — several bugs
here were fixed twice because the reason was missing the first time.

**No emoji, no decorative comments.** Plain prose in comments, British spelling.

**Don't reformat files you aren't changing.** The diffs get uploaded through
GitHub's web UI by hand.

---

## Setup

- **Repo**: GitHub `ai-saas-pro`, branch **`mvp-rebuild`** (master is the old
  abandoned project — do not touch it)
- **Hosting**: Vercel, Hobby plan. Deploys from `mvp-rebuild` as a preview.
- **Database**: Supabase, project `automology-dev`, ref `rsqunoccuvrgjjyhzuoy`, region
  ap-northeast-1 (Tokyo, not Singapore as this line used to say)
- **Model**: Gemini via `GEMINI_API_KEY`. `lib/llm.ts` supports Anthropic too —
  set `LLM_PROVIDER` if both keys exist.
- **Uploads**: the work PC blocks `git push`. Everything goes through GitHub's
  web uploader, so **whole folders at a time**.

### Environment variables

| Variable | Status | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | set | Must end at `.supabase.co` — no `/rest/v1/` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | set | |
| `SUPABASE_SERVICE_ROLE_KEY` | set | |
| `GEMINI_API_KEY` | set | |
| `LLM_MODEL` | set | `gemini-3.6-flash` — Google retires names periodically |
| `DASHBOARD_PASSWORD` | set | Master key, sees every business |
| `RESEND_API_KEY` | set | **Sending domain not verified — email goes to spam** |
| `EMAIL_FROM` | not set | Falls back to `onboarding@resend.dev`, Resend's sandbox sender. Undocumented until now. See `lib/email.ts:14` |
| `CRON_SECRET` | set | Confirmed live: `/api/health` reports `"cron":"set"` |
| `STRIPE_SECRET_KEY` | not set | |
| `STRIPE_WEBHOOK_SECRET` | not set | Webhook rejects everything without it |

---

## Migrations

39 files in `db/`, run manually in the Supabase SQL editor, in numerical order.
`db/README.md` has the full list and what each adds.

**After any migration:**

```sql
select verify_schema();   -- is everything present?
select smoke_test();      -- does everything actually run?
```

`verify_schema()` checks 34 tables, 18 columns and 74 functions and names the
exact file to re-run. `smoke_test()` calls the live paths — a function can
exist and still throw the moment it's used.

It was written in 0031 and only knows the schema as of 0031. Nothing added by
0032–0035 is in its lists — not `agencies`, `booking_attempts`, `waitlist`,
`reviews`, `portal_codes`, `portal_sessions`, nor their functions. A green
`verify_schema()` is not evidence those four files landed. `smoke_test()` is
the better signal, because it calls things.

### Traps that have cost real time here

- **`text[] || 'literal'` is ambiguous.** Postgres may read it as array-concat
  and try to parse your sentence as an array literal. Use `array_append()`.
  This broke 31 places across four files.
- **`json` has no `=` or `<>` operator.** Only `jsonb` does. Compare as text.
- **`json_agg(x order by x.col)`** only works if the subquery selects `col`.
  Broke three separate times.
- **Two joined tables sharing a column name** need qualifying, including inside
  `filter (where ...)`.
- **A function used before it's defined** in the same file compiles fine and
  fails at call time.
- **pgcrypto is installed, but in the `extensions` schema.** Every function here
  is declared `set search_path = public`, so an unqualified `gen_random_bytes`
  still fails to resolve. `0024_random_fallback.sql` removed the dependency;
  don't reintroduce it. (The note here used to say pgcrypto wasn't enabled at
  all. It is — the advice was right for the wrong reason.)
- **Vercel Hobby allows one cron run per day.** Asking for more fails the whole
  deployment. `vercel.json` is set to daily; `CRON.md` explains the free
  workaround with an external scheduler.

---

## Architecture

### Account hierarchy

```
Automology master
  └── Agency (optional white-label reseller)
        └── Client business
  └── Direct business
        ├── Branches (organisation)
        ├── Staff (owner / manager / staff / viewer)
        ├── Practitioners (bookable resources)
        └── AI employees (public or internal)
              └── Customer
```

### How an agent is built

```
sector template  (clinic / salon / hr / owner / support …)
  + {{SERVICES}}    ← live price list
  + {{KNOWLEDGE}}   ← typed notes and uploaded documents
  = compiled_prompt   stored on the agent
```

A price edit calls `rebuild_prompt()`; the agent quotes the new figure on the
next message. **Never edit `compiled_prompt` directly** — edit
`prompt_template` and rebuild.

### Agents act through tags

The model emits a tag, the server validates and executes it. The model never
receives an id and never writes SQL.

- `[[BOOK service="…" when="…" name="…" phone="…" email="…" reason="…"]]`
- `[[DO action="confirm" ref="2"]]` — owner assistant only, refs come from a
  numbered list the server just sent
- `[[HANDOVER to="agent-slug" reason="…"]]` — **designed, not built.** No
  prompt emits it and the chat route parses only `[[BOOK]]`, so a handover tag
  would reach the customer as raw text rather than being stripped.

The server strips tags before the customer sees them.

### Public vs internal agents

A **public** agent talks to customers and knows only published information. An
**internal** agent (HR, payroll, finance, owner insights) knows staff-only
material and is blocked in the chat route without a business session.

**A public agent may never hand over to an internal one.** That check is in the
database, not the prompt — a prompt can be argued with.

---

## Key routes

| Route | Who |
|---|---|
| `/` | Landing page |
| `/start` | Self-serve signup, 4 steps |
| `/login` | Key-based sign in |
| `/demo/<slug>` | The customer's page, 4 languages, Arabic RTL |
| `/embed/<slug>` | Iframe for a client's own website |
| `/my/<slug>` | Customer portal, code sign-in |
| `/b/<token>` | Cancel or reschedule one booking, no login |
| `/review/<token>` | Leave a review |
| `/dashboard/<slug>` | 13-module business workspace |
| `/group/<org>` | All branches |
| `/agency/<slug>` | Reseller dashboard |
| `/master` | Platform view, master password only |
| `/api/health` | Reports env and schema state |

---

## Two bugs worth knowing about, because both recurred

**Middleware cannot read a request body.** It is a stream, and consuming it
breaks the route handler. A check that rejected requests with no slug in the
*URL* silently blocked every write from a tenant session, while working fine
for the master password. Slug checks for POSTs live in the route handlers now.

**A check that fails closed and silently looks like a permissions problem.**
The dashboard once fetched its role from a separate endpoint that middleware
blocked; the failed response had no role, the code defaulted to `viewer`, and
every control went read-only with no error. Role now travels with the data and
is displayed in the sidebar.

---

## Current state

**Verified live, 17 Sep 2026, against the deployment rather than on paper:**
safety 5/5 (no medication advice, no reading interpreted, 999 only for chest
pain with no booking made, recovers to normal questions afterwards, holds
against prompt injection). Booking 5/5 (asks for the phone, reads the booking
back before acting, saves correctly, refuses a double-booking, refuses a closed
day and offers alternatives). Timezone correct: stored 07:00 UTC, shown 15:00
local. Prices quoted match the price list. `/b/<token>` works. A null price is
answered "priced on enquiry" rather than invented.

**Signup was broken and is now fixed.** `create_tenant` never set the agent's
`slug`, so every business made through `/start` had a public page with no chat
on it at all — header and price list, no input, no button, no error. See
`0038_signup_agent_fix.sql`. It was listed here as "verified live" the whole
time it was broken.

**Schema: all 37 files have run.** Checked against the live database on
16 Sep 2026, not assumed. `smoke_test()` returns 9/9, every path running:
`platform_data`, `dashboard_data`, `get_widget_config`, `rebuild_prompt`,
`analytics`, `list_agents`, `master_overview`, `business_briefing`,
`create_tenant`. Four tenants exist. This section previously said 0026–0037
had never been executed; that was wrong for months and sent at least one
evening's work in the wrong direction.

**Never built, despite being written up elsewhere:** the inbox and the
`[[HANDOVER]]` tag. There is no `/dashboard/<slug>/inbox` route, no handover
parser in the chat route, and no `colleagues()` function. Section D of
`docs/AUTOMOLOGY_TEST_LIST.html` tests all three and cannot pass. The rule that
a public agent may never hand over to an internal one is not enforced anywhere,
because there is nothing to enforce it against yet.

**Blocked on a key, not code:** email that arrives, and payments. `CRON_SECRET`
is now set and live. For email, DNS for `automology.com` is at Cloudflare and
`contact.automology.com` does not resolve at all — no A, CNAME, TXT, MX or
DKIM — so whatever was set up in Resend is waiting on records that were never
created. Cloudflare proxies by default and proxying breaks mail records: each
one must be set to "DNS only".

**Not built:** four of the twelve AI roles, nine of ten channels, support
tickets, sales pipeline, loyalty, operations, voice, cross-agent event bus,
per-agent management page, daily morning briefing.

---

## What matters next

1. Run the test list in `docs/AUTOMOLOGY_TEST_LIST.html` — 40 numbered checks,
   less section D, which tests features that were never built
2. `CRON_SECRET` and a verified sending domain
3. Stripe keys
4. **Put one real clinic on it.** There are zero customers. The previous
   project died of building past the point where building was the constraint,
   and this one is at that point again.

---

## Working preferences

- Short, direct. No preamble.
- Build incrementally, check in often.
- Say what is unverified. "Compiled" is not "working" — six SQL files this
  project passed every check and still failed on contact with the database.
- Never invent a number or a fact about the codebase. Check it.
- When something breaks, find the cause before proposing a fix.
