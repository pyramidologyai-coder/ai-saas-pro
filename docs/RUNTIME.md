# Runtime — what happens when a message arrives

The full design has 22 steps. The MVP needs these 9. The other 13 are real and
deferred; they are listed at the bottom so nobody thinks they were forgotten.

Order is fixed. No step is optional. This is the contract
`app/api/chat/route.ts` implements.

---

## The 9 steps

### 1 · Receive
`POST /api/chat` → `{ slug, session, message }`

Reject anything over 2,000 characters. Rate-limit by session: 20 messages per
minute.

### 2 · Dedupe
Build an idempotency key from `session + hash(message) + minute`. If a message
row already exists with that key, return the previous reply.

A retried send must never produce two answers. The browser will retry.

### 3 · Resolve
Look up the tenant by slug → its `ai_employees` row → find or create the
customer by `(tenant_id, external_id=session)` → find the open conversation or
open a new one.

`tenant_id` comes from the slug lookup, server-side. **Never from the request
body.**

### 4 · Hard blocks
Stop here, before spending anything, if:

| Block | Condition | Response |
|---|---|---|
| `OptOutRecorded` | `customers.opted_out` | Nothing sends. Ever. |
| `WalletEmpty` | `tenants.wallet_balance_usd <= 0` | Paused message. No grace period. |
| `CostCapExceeded` | conversation cost > $0.40 | Stop, log an incident, escalate |

These are not warnings. They return before the model is called.

### 5 · Load
Read `ai_employees.compiled_prompt` — **do not compile here.** Load the last 10
messages of the conversation, oldest first.

If `compiled_prompt` is null, that's a configuration error: alert and refuse.
Do not silently fall back to a generic prompt.

### 6 · Ask the model
System prompt + history + new message. One provider. Enable prompt caching on
the system prompt — it is identical across every message for this tenant and is
the single highest-ROI cost saving available.

Timeout at 20 seconds.

### 7 · Act
Inspect the reply for an intent:

- **Booking** → check the slot is free, write to `bookings`. The unique index on
  `(tenant_id, scheduled_at)` is the optimistic lock — if it collides, tell the
  customer that slot just went, don't overwrite.
- **Escalation** → write to `escalations`, tell the customer a person will
  follow up, and do **not** send the model's own answer.

### 8 · Persist
In this order, before returning anything:

1. Insert the customer message and the AI message
2. Insert the `ai_decision_log` row — **three cost numbers**
3. Debit `usage_ledger` and update the wallet balance

If the browser drops the response, the conversation must still exist.

### 9 · Reply
Return `{ reply, conversation_id }`.

---

## The three cost numbers

Every message writes all three. Most companies track one and then cannot
compute margin eighteen months later.

| Column | Meaning |
|---|---|
| `actual_execution_cost` | What the model call really cost, cached tokens counted at the cached rate |
| `allocated_platform_cost` | This conversation's share of infrastructure |
| `billable_usage_value` | What we charge for it |

The columns already exist. Filling them is cheap now and near-impossible to
backfill.

---

## Errors

| Failure | What the customer sees | What we do |
|---|---|---|
| Model API down | "Give me a moment — I'll have someone get back to you." | Open an escalation |
| Model times out | Same | Open an escalation |
| Database write fails | Generic apology | Alert. Never pretend it saved. |
| Unknown tenant slug | 404 | — |
| Rate limited | "One moment please." | 429 |

Never show a stack trace. Never show a spinner that doesn't end.

---

## Deferred from the full 22-step design

Present in `RUNTIME_DATA_FLOW.md`, not in the MVP:

Channel classification (only one channel) · agent selection (only one agent) ·
per-request role compilation (cached instead) · long-term memory load ·
conversation classification C1–C4 · compliance pre-check as a separate step
(folded into the prompt) · model routing across tiers · the multi-hop cognitive
loop · a general tool-execution gateway · compliance post-check · confidence
scoring · event publishing · distributed tracing.

Each becomes necessary at a specific point — a second channel, a second agent, a
second model tier. None of them is necessary to answer one message correctly,
which is the only thing the demo has to do.
