# Database — how to set it up

Four files. Run them in Supabase's SQL Editor, in number order.
Copy the whole file, paste, click Run. Each takes seconds.

| File | What it does | Expected result |
|---|---|---|
| `0001_init.sql` | Creates the 11 tables, security rules, indexes | "Success. No rows returned" |
| `0002_seed.sql` | Adds the demo business (Sunrise Hair Studio) | "Success" — check Table Editor |
| `0003_functions.sql` | Adds the wallet functions the app calls | "Success. No rows returned" |
| `0004_isolation_test.sql` | Proves one business can't read another's data | Rows of **PASS** |

## The 11 tables, in plain words

| Table | Holds |
|---|---|
| `tenants` | The businesses (your customers) + their wallet balance |
| `profiles` | The humans who log in, linked to their business |
| `ai_employees` | Each business's AI worker + its compiled prompt |
| `items` | Services and prices (what the AI quotes) |
| `customers` | The end customers who chat |
| `conversations` | One row per chat thread |
| `messages` | Every message, both sides |
| `bookings` | Appointments the AI made |
| `ai_decision_log` | One row per AI reply: tokens, latency, the 3 cost numbers |
| `escalations` | Chats handed to a human, and why |
| `usage_ledger` | Every wallet debit and top-up, with balance after |

## Rules built into the schema

- **Every table has `tenant_id`.** Every query is scoped to one business.
- **Row Level Security is ON for all 11 tables.** A logged-in user can only
  see rows belonging to their own business. This is what `0004` proves.
- **The server derives `tenant_id` from the login — never from the browser.**
- **Bookings have a unique index on `(tenant_id, scheduled_at)`.** Two
  customers can't book the same slot; the second insert fails politely.
- **The wallet and the ledger always agree.** `debit_wallet()` updates both
  in one transaction.

## After running all four

Give the demo tenant some credit so the hard-block doesn't fire:

```sql
select topup_wallet(id, 10.00, 'demo credit')
from tenants where slug = 'sunrise-hair';
```

Then check:

```sql
select name, wallet_balance_usd from tenants;
```

## If something fails

- **Error in 0001** → paste the exact red error message to Claude. Don't retry blindly.
- **FAIL row in 0004** → stop building. This is the company-ending bug caught
  early, which is the whole point of the test. Copy the FAIL line and debug
  the policy for that table before anything else.
- **Ran a file twice by accident** → harmless. All four are safe to re-run.

## What is NOT here on purpose

No billing tables, no plans/subscriptions, no teams, no API keys, no audit
trails beyond the ledger, no analytics tables. All designed in the old repo,
all deferred. The 11 tables above are exactly what one demo needs.
