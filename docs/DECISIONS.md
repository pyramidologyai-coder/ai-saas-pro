# Decisions

Append-only. Newest at the bottom. A decision that isn't written here can be
reversed by a mood; one that is written here needs an argument.

Format: what we decided, why, and what would make us change our minds.

---

## ADR-001 — MVP scope reduction

**Date:** ______  **Status:** Accepted  **Deciders:** ______

### Context

The original MVP covered 12 agent roles × 12 verticals × 10 channels × 5
markets × 3 database regions × 9 model providers, with no deferrals. We are two
people working evenings and weekends — about 20 hours a week, ~240 hours a
quarter. The declared scope needs roughly ten times that. After three weeks we
had 242 specification files and no running software.

### Decision

The MVP is:

- **One agent** — AGENT-001, the Receptionist
- **One vertical** — ______________
- **One channel** — web chat widget
- **One market, one region, one model provider, one payment path**
- **Target** — a demo we can screen-share to prospects we already have

Everything else moves to `/archive` in the old repo. Nothing is deleted. It
stops being a launch requirement; it does not stop existing.

### Why one agent rather than several

A small business does not buy "roles." They buy *my messages get answered*. The
Receptionist already covers most of that. Adding a second and third agent
requires the multi-agent handoff protocol, which is unwritten — roughly triple
the work for maybe 15% more value to the customer.

If a prospect asks for something the Receptionist doesn't do, that is usually
three lines in its prompt, not a new agent. **Widen the one agent. Don't split it.**

### Why webchat before WhatsApp

WhatsApp needs Meta Business verification — an approval queue we do not control,
measured in days or weeks. A bad first dependency when we work evenings. Webchat
can be live this week. WhatsApp comes after the first customer says yes, when
waiting costs us nothing.

### Why voice is deferred entirely

Highest cost per minute, tightest latency budget, heaviest per-jurisdiction
compliance load (call-recording consent), least learning per hour invested. It
is the last channel, not an MVP one.

### Consequences

- **Good:** a demo becomes reachable in ~55 hours instead of never.
- **Good:** the compile-chain thesis gets tested against one real vertical
  rather than assumed across twelve.
- **Bad:** the "hire an AI workforce" positioning is harder to show with one role.
- **Bad:** some specification work will need revision once implementation
  exposes gaps. Expected, and better than revising it twelve times.
- **Neutral:** PRODUCTION_GATE, the SOPs and several docs now describe a larger
  scope than the MVP. Archived rather than corrected.

### What would change our minds

Revisited once we have real conversation data. The second vertical and second
agent get chosen from what prospects actually ask for, not from the original
taxonomy.

---

## ADR-002 — Vertical: ______________

**Date:** ______  **Status:** Proposed

### Decision

______________

### Why this one

Criteria, in priority order: we already have a way in · they visibly miss
enquiries · they have a website the widget can sit on · their questions repeat ·
the owner is blunt enough to tell us it's bad · **a wrong answer costs an
apology, not a lawsuit**.

> On that last point: our own specs treat clinic as the flagship vertical. For
> the *first* live one that is the wrong choice — health-adjacent answers carry
> real risk and we have no eval harness, no injection defence and no escalation
> inbox yet. Salon, restaurant, gym and retail are far more forgiving. Clinic
> comes later, with the safety tooling in place.

---

## ADR-003 — Price

**Date:** ______  **Status:** Proposed

### Decision

Monthly: ______  ·  Included conversations: ______  ·  Overage: ______

### Reasoning

Cost to serve is roughly **$4.50/month at 300 conversations** (~630-token
prompt, one model tier, webchat so no per-message channel fee). Almost any
price is high-margin, so this is a value decision, not a cost one.

Anchor: what one missed booking is worth to them, times the ones they currently
miss. Suggested starting range **$79–149/month** — priced against a few hours of
part-time reception cover, not against staff replacement.

**Do not launch free.** A free customer gives us a user, not evidence. Even a
nominal payment changes what they tell us and whether they actually use it. We
are buying the signal, not the revenue.

---

## ADR-004 — Compiled prompts are cached, not built per request

**Date:** ______  **Status:** Accepted

The runtime spec puts compilation at step 6 of every message. Compiling per
request is a fixed latency tax on every conversation and a single point of total
failure.

Compile on config change; write to `ai_employees.compiled_prompt` and bump
`config_version`. Read the column at runtime.

---

## ADR-005 — Safety fields cannot be overridden by tenant config

**Date:** ______  **Status:** Accepted

Precedence in the compiler:

| Conflict | Winner |
|---|---|
| Tenant vs sector | Tenant — tone, hours, services, names |
| Sector vs base role | Sector — vocabulary, examples, escalation triggers |
| Anything vs a safety field | **Most restrictive value, always** |
| Field present in none of the three | **Fail loudly.** Never silently default |

Tested with a hostile tenant config attempting to set
`no_clinical_commentary: false` and blank the compliance rules. Both rejected
and logged.
