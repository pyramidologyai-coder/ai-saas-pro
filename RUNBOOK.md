# RUNBOOK — from nothing to a working demo

One list, in order. Do the next unchecked box. Don't skip ahead.
Every box is small enough to finish in one sitting.

Legend: **[D]** main dev · **[S]** second · **[B]** both · ⏱ estimate

---

## GATE 0 — Foundations · ~8h · "the database runs and is safe"

- [ ] **[D]** ⏱30m — Unzip the repo. `git init && git add . && git commit -m "skeleton"`. Create the GitHub repo, push.
- [ ] **[D]** ⏱30m — In the OLD repo, make an `/archive` folder and move everything except the 6 carried files into it. Commit. (Nothing deleted, just out of the way.)
- [ ] **[B]** ⏱30m — Open `docs/DECISIONS.md`. Fill the blanks in ADR-002 (vertical) and ADR-003 (price). This is the meeting. Two answers.
- [ ] **[D]** ⏱20m — New Supabase project (call it `automology-dev`). SQL Editor → paste `db/0001_init.sql` → Run.
- [ ] **[D]** ⏱10m — Same editor → paste `db/0002_seed.sql` → Run. Table Editor: confirm 11 tables + "Sunrise Hair Studio".
- [ ] **[D]** ⏱30m — **Isolation test.** Run `db/0004_isolation_test.sql`. Every row must say PASS. *Do not proceed until it does.*
- [ ] **[D]** ⏱30m — `npm install`. `cp .env.example .env.local`, fill Supabase keys. `npm run dev` — blank page is fine.
- [ ] **[D]** ⏱1h — New Vercel project, connect the repo, add the env vars, deploy. Prove the pipe works.
- [ ] **[S]** ⏱1h — Open `tests/golden.md`. Replace the `[bracketed]` placeholders with the chosen vertical's real services and prices. You now have the definition of "working" before any prompt exists.
- [ ] **[D]** ⏱20m — `pip install pyyaml && python scripts/compile.py --agent AGENT-001 --sector <your-vertical> --tenant scripts/tenants/sunrise-salon.json`. Confirm it prints a prompt and token count.

> **Gate 0 done when:** repo pushed · 11 tables live · cross-tenant query returns 0 · compiler runs · Vercel deploys. That closes the Define phase.

---

## GATE 1 — The spine · ~18h · "one message gets one real answer"

- [ ] **[D]** ⏱4h — Port `scripts/compile.py` → finish `lib/compile.ts`. Same precedence (ADR-005). Verify TS output matches Python output for the same inputs.
- [ ] **[D]** ⏱1h — Write a tiny script that runs the compiler and saves the result into `ai_employees.compiled_prompt` + `compiled_tokens` for the demo tenant. Run it. (Compile on config change — never per message. ADR-004.)
- [ ] **[D]** ⏱2h — Fill in `lib/llm.ts` keys and test one raw call to the model. Confirm it returns text and a token count.
- [ ] **[D]** ⏱6h — Finish `app/api/chat/route.ts`. The dedupe, resolve, hard-blocks, load, ask, persist and reply steps are written — wire them to the real DB and remove the `debit_wallet` RPC stub (do the ledger insert inline for now).
- [ ] **[D]** ⏱1h — Confirm the three cost numbers land in `ai_decision_log` on every message.
- [ ] **[D]** ⏱2h — Add the $0.40 cost cap and the wallet-empty / opted-out hard blocks. Test each fires.
- [ ] **[S]** ⏱2h — Write the first real system prompt for the chosen vertical. Start from the compiler's draft; add the real business's quirks. Run 5 golden questions against it by hand.

> **Gate 1 done when:** the `curl` in `docs/WORKPLAN.md` returns a correct answer AND a cost row exists in the database. That's the whole Measure phase — you now have real numbers.

---

## GATE 2 — Survives a stranger · ~20h · "usable on a phone without breaking"

- [ ] **[S]** ⏱5h — Build the chat widget in `app/demo/[slug]/`: message list, input, send, typing indicator.
- [ ] **[S]** ⏱1h — Session id in browser storage so a refresh continues the chat.
- [ ] **[S]** ⏱1h — Three suggested opening questions as tappable buttons.
- [ ] **[S]** ⏱3h — Style the demo page as the prospect's own business — logo, colours, name.
- [ ] **[S]** ⏱4h — Dashboard: conversations list + click-to-read thread.
- [ ] **[S]** ⏱2h — Dashboard: escalations panel + bookings list.
- [ ] **[S]** ⏱2h — **Editable prices → recompile.** The closer. Edit a price, re-run the compiler, agent quotes the new number. Don't cut this.
- [ ] **[D]** ⏱3h — Booking write path: detect a booking intent, check the slot, insert. The unique index is the lock — on collision, say the slot just went.
- [ ] **[D]** ⏱2h — Escalation write path: on a safety trigger, write the row + tell the customer a person will follow up. Don't send the model's answer.
- [ ] **[S]** ⏱3h — Finish and score all 30 golden questions. Fix the prompt one change at a time, re-run all 30 each time.
- [ ] **[B]** ⏱2h — Adversarial pass (`docs/WORKPLAN.md` §2.11). Every item must pass.
- [ ] **[B]** ⏱1h — Open it on a real phone. Fix whatever's broken. Every prospect will do this.

> **Gate 2 done when:** someone who's never seen it uses it on their phone, it answers correctly, refuses when it should, and you can show the conversation + cost + booking in the dashboard.

---

## GATE 3 — Ready to pitch · ~9h · "demo rehearsed, call booked"

- [ ] **[S]** ⏱2h — Configure a real prospect as the demo tenant. Real name, real services, real prices.
- [ ] **[S]** ⏱2h — Their branding on the demo page.
- [ ] **[B]** ⏱2h — Rehearse the 8-minute demo (script in the MVP build plan, §09), twice, out loud. Time it.
- [ ] **[B]** ⏱1h — Write down your answers to the five objections. Have the price ready as one number.
- [ ] **[Either]** ⏱1h — Rewrite `README.md` to match what now exists.
- [ ] **[Founder]** ⏱1h — Book the first prospect call.

> **Gate 3 done when:** you could screen-share it to a stranger right now and not be embarrassed.

---

## If you only do three things this week

1. **[B]** Set the price and pick the vertical — 30 minutes, unblocks everything.
2. **[D]** Run both migrations and pass the isolation test — turns a Word doc into a safe database.
3. **[S]** Fill in the 30 golden questions with real prices — defines "working" before any code.

Everything else follows from those three.

---

## The rules that keep this honest

- If it isn't visible in a screen-share, it's out of scope.
- Nothing gets built until someone is waiting for it.
- The compiled prompt is cached, never rebuilt per message.
- `tenant_id` is derived server-side, never sent by the browser.
- Three cost numbers on every message, from the first one.
- Newest file two weeks running is a `.md` → stop and re-cut.
