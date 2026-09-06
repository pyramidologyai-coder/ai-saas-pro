# Automology

AI employees for small businesses. A business hires a named AI worker that
answers customer messages, quotes prices, and books appointments — instead of
buying chatbot software.

**Current goal:** a working demo of one agent, one vertical, one channel, that
we can screen-share to prospects.

---

## What actually exists right now

| Thing | State |
|---|---|
| Database schema (11 tables) | ✅ Written, not yet run |
| Agent compiler (Python) | ✅ Working, measured |
| Agent compiler (TypeScript) | ⬜ To port |
| Chat API route | ⬜ Skeleton only |
| Chat widget | ⬜ Not started |
| Dashboard | ⬜ Not started |
| Golden test set | ⬜ Template only |
| Paying customer | ⬜ None |

Anything not in this table does not exist. If you find a document describing a
feature that isn't listed here, it is a plan, not a thing.

---

## The core idea

An agent is not code. It is a **compilation of three layers**, resolved into a
system prompt:

```
  agents/AGENT-001-receptionist.md     what a receptionist is (written once)
+ agents/sectors/salon.yaml            how salons differ    (once per vertical)
+ ai_employees.config (in DB)          this business        (once per customer)
─────────────────────────────────────
= a live agent with a system prompt
```

Adding a vertical is a YAML file. Adding a customer is a form. That is the
whole commercial argument — competitors who hardcode verticals need an
engineering project to add the next one.

### This is measured, not assumed

Run `python scripts/compile.py --agent AGENT-001 --diff clinic salon`:

- Compiled prompt: **~630 tokens** (budget was 1,500 — we are at 42%)
- Clinic vs salon: **42.5% similar** — the verticals genuinely differ
- A tenant **cannot** switch off a safety rule (tested with a hostile config)

---

## Repo layout

```
app/api/chat/route.ts     the brain — message in, reply out
app/demo/[slug]/          the page a prospect opens
app/dashboard/            conversations, escalations, bookings, prices
lib/compile.ts            the three-layer compiler
lib/llm.ts                one model provider, one function
agents/                   role spec + sector patches
db/                       SQL migrations (run in order)
docs/                     five documents, no more
tests/golden.md           the questions that define "working"
scripts/compile.py        reference implementation of the compiler
```

---

## Setup

```bash
npm install
cp .env.example .env.local     # fill in Supabase + model keys
```

Then in Supabase → SQL Editor, run in order:

1. `db/0001_init.sql`
2. `db/0002_seed.sql`

Verify isolation before building anything on top:

```sql
-- signed in as tenant A, query tenant B. Must return 0 rows.
select count(*) from conversations where tenant_id = '<tenant-B-id>';
```

Then:

```bash
npm run dev
python scripts/compile.py --agent AGENT-001 --sector salon \
  --tenant scripts/tenants/sunrise-salon.json
```

---

## Rules we actually follow

1. **If it isn't visible in a screen-share, it isn't in scope.** No billing,
   no onboarding flow, no admin panel until a customer asks.
2. **Nothing gets built until someone is waiting for it.**
3. **The compiled prompt is cached, never rebuilt per message.**
4. **`tenant_id` is never sent by the browser.** It is derived from the
   logged-in user, server-side, always.
5. **Every conversation logs three cost numbers**, from the very first message.
6. **A spec not implemented within 60 days moves to `/archive`.**
7. **Docs before code — except spikes.** A timeboxed experiment may come first;
   its output is the spec.

## Who does what

| Lane | Owner |
|---|---|
| Database, compiler, chat API | Main dev |
| Widget, prompts, golden tests, dashboard | Second |
| Production deploys | Founder approves |

Branch per lane. Merge weekly. Nobody edits outside their lane without saying
so first.

---

## Deliberately not doing yet

11 other agent roles · 11 other verticals · WhatsApp, voice, and 8 other
channels · multi-region · 9 model providers · payment gateways · RAG and
embeddings. All designed, all archived, none deleted.
