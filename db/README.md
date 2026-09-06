# Migrations

Run these in Supabase → SQL Editor, **in numerical order**, one at a time.
Confirm each succeeds before starting the next.

A file that errors halfway applies everything before the error and nothing
after it. Postgres won't warn you, and the next five files will appear to work
while the app doesn't. That has cost more time on this project than any other
single thing.

## After any migration

```sql
select verify_schema();   -- is everything present?
select smoke_test();      -- does everything actually run?
```

`verify_schema()` checks 34 tables, 18 columns and 70 functions, and names the
exact file to re-run if something is missing. `smoke_test()` calls the live
paths — a function can exist and still throw the moment it's used.

`/api/health` reports the same thing, so you can check from a browser.

## The order

| File | What it adds |
|---|---|
| 0001 | tables, RLS scaffolding |
| 0002 | salon demo tenant |
| 0003 | wallet functions |
| 0004 | isolation test |
| 0005 | domain whitelist |
| 0006 | salon prompt |
| 0007 | branding columns |
| 0008 | clinic tenant, medical safety prompt |
| 0009 | bookings, `[[BOOK]]` tag |
| 0010 | booking timezone fix |
| 0011 | dashboard data, price editor |
| 0012 | prompt rebuild fix |
| 0013 | template-based prompts |
| 0014 | thread view, escalations, booking actions |
| 0015 | public page data |
| 0016 | self-serve signup, sector templates |
| 0017 | multi-agent, HR/payroll/finance |
| 0018 | team, marketing, finance, settings |
| 0019 | editable settings, enforced roles |
| 0020 | knowledge, email, billing |
| 0021 | branches, audit log, automations |
| 0022 | custom domains, send queue, analytics |
| 0023 | practitioners, notifications, credentials |
| 0024 | removes the pgcrypto dependency |
| 0025 | platform_data fix |
| 0026 | row-level security |
| 0027 | document upload |
| 0028 | master portal |
| 0029 | owner insights agent |
| 0030 | customer self-service |
| 0031 | schema verification — run last |

## If something breaks

1. Read the error. It names the column or function.
2. `select verify_schema();` — it tells you which file to re-run.
3. Every file is `create or replace` and safe to run again.

## Known traps hit on this project

- **pgcrypto isn't enabled** on every Supabase project. `0024` removes the
  dependency. Symptom: `gen_random_bytes does not exist`.
- **`json_agg(x order by x.col)`** only works if the subquery selects `col`.
  Broke three times. Symptom: `column x.col does not exist`.
- **Two joined tables sharing a column name** need qualifying. Symptom:
  `column reference "status" is ambiguous`.
- **A function used before it's defined** in the same file. Postgres allows the
  definition but fails at call time.
