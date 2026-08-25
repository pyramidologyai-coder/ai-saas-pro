# UI & UX

Two surfaces. They should feel completely different from each other.

- **The widget** — for the salon's end customer, booking a haircut on their phone at 9pm. Should be invisible. If they notice the UI, the UI failed.
- **The dashboard** — for the salon owner, checking what happened while they were closed. Should be legible. Restraint reads as trust.

This file is the contract between the two of you: the second person builds against these rules; the main dev doesn't second-guess them at PR time.

---

## 1 · The widget — customer-facing chat

### Placement & shape
- Bottom-right corner. One circular bubble with the business logo. Subtle pulse on first visit only.
- When open: **380 × 580 px on desktop, full-screen on mobile.**
- Every messenger widget on the internet lives bottom-right. Familiarity is the feature — don't be creative about placement.

### The chat panel
- **Header** — persona name + small avatar + business name. Small "close" X, no minimize.
- **Message list** — one column. Customer messages right-aligned, agent messages left-aligned with the persona's avatar. Bubbles: ~14px text, comfortable line height, no shadows.
- **Timestamps** on hover only, or on messages more than a few minutes apart. Every message stamped = noise.
- **Input** — single line that expands to 3 rows max. `Enter` sends, `Shift+Enter` new line. Send button next to it, disabled until there's text.

### The first three seconds matter more than anything else
When the widget opens, the greeting is **already visible** — not typing, present. `"Hi! I'm Aisha, the receptionist at Sunrise. How can I help?"` Instantly-present agents feel real. Agents that make you wait for hello feel like software.

### The three signals people watch for, in priority order
1. **Typing indicator** — three dots within 300ms of send. Silence for two seconds feels broken even if the reply arrives at second three.
2. **Message-delivered state** — the customer's message appears in the transcript instantly. If it stalls they'll send it twice, and dedupe better catch it.
3. **A visible boundary when the agent hands over** — a small centred divider: *"Aisha will get a colleague to follow up shortly."* Without it the customer keeps typing at the void.

### Suggested opening chips
Three tappable chips above the input, first visit only. Removes the empty-box freeze and demonstrates what the agent can do in one glance.

Example for a salon:
- `What are your hours?`
- `How much for balayage?`
- `Book an appointment`

Bonus: the chip they tap first tells you what mattered.

### Branding rules
The widget is styled as **the business**, not as Automology. Their logo, their brand accent, the persona's name. **No Automology branding visible to end customers, ever.** That's the whole product positioning — the salon owner is hiring an employee, not renting software.

A subtle *"Powered by Automology"* footer only starts to make sense when three paying customers exist and it becomes a growth channel. Not before.

### Mobile-first
80% of these conversations happen on phones. **Test on your phone before your laptop.** Every prospect will do the same in the demo.

### What NOT to build for the widget
- No emoji reactions
- No file uploads
- No voice notes
- No message editing
- No read receipts
- No dark mode toggle
- No settings menu (there are no settings)

---

## 2 · The dashboard — owner-facing

### One page, four sections, no navigation menu

```
┌────────────────┬──────────────────────────────────────────┐
│                │                                          │
│  Conversations │   selected conversation opens here       │
│  Needs you     │                                          │
│  Bookings      │                                          │
│  Services      │                                          │
│                │                                          │
└────────────────┴──────────────────────────────────────────┘
```

Sidebar or top tabs, that's the whole navigation. You'll be tempted to add "Analytics", "Settings", "Team". Don't — every extra menu item is something to explain in the demo.

### Conversations — the home page
- Most recent at the top.
- One row per conversation:
  - Customer name (or session id if unknown)
  - First line of the last message, truncated
  - Small badge if escalated
  - **Small cost figure at the far right** — `$0.03`, grey, tiny font
- Click a row → thread opens in the right pane.
- No pagination for the demo. The list is short.

### Cost per conversation — small and honest
`$0.03` in grey, corner-right of each conversation row. Not a chart, not a KPI card, not a dashboard. Just a small honest number.

**Why this matters:** almost no one demoing an AI product can show cost per conversation. Doing so signals you understand your own economics — which is rare and credible. Don't make it big; make it present.

### Services — the closer
Editable table. Name, price, duration.

Edit a price → click save → within ~2 seconds the compiler re-fires and the agent quotes the new number.

**This one interaction is worth more than the rest of the dashboard combined. Build it well.**

Toast: `"Updated. Agent will quote the new price on the next message."` Then in the demo you switch tabs back to the widget, ask about that service, and the new price appears. That's the sale.

Order of build priority within the dashboard: **Services (with live recompile) → Conversations list → Escalations → Bookings.**

### Escalations — plain list, not a full inbox
For the demo you're proving the *behaviour* exists, not building a helpdesk.

Columns: time · customer · reason · message thread. That's enough.

Not needed for MVP: assignment, SLAs, notes, statuses beyond open/resolved, notifications. All Gate 3+.

### Bookings — plain list too
Columns: time · customer · service · status. Read-only for MVP. Editing bookings from the dashboard is Gate 3.

---

## 3 · Design decisions that apply everywhere

### Typography
- **One typeface.** Inter, or the system UI stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`).
- Don't reach for anything with personality. In business tools, trust comes from restraint. Save personality for the persona's tone of voice, not the font.

### Colour
- **One accent colour.** One. The business's brand colour if you know it (Gate 3), otherwise neutral blue or green as placeholder.
- Everything else greyscale.
- Two-colour interfaces read as intentional. Four-colour interfaces read as unfinished.

### Loading states are honest
- Never a spinner without context.
- `"Sending..."` beats a whirl.
- `"Thinking..."` under the typing indicator beats dots that go on forever.
- If something takes >3 seconds, say something.

### Empty states are directional
Every empty state teaches the next action.

- Dashboard with no conversations: `"No conversations yet. Open the widget on the demo page and try it."`
- No escalations: `"Nothing needs you right now. That's the point."`
- No bookings: `"No bookings yet. Try booking through the widget."`

Never a sad empty inbox.

### Errors admit fault, don't blame the user
- ✅ `"That didn't send. I've saved your message — try again?"`
- ❌ `"An error occurred."`
- ❌ `"Invalid input."`

### Motion
Two animations permitted. That's the whole list:
- Message bubbles fade+slide in (150ms)
- Typing dots

Beyond that: nothing. Motion in B2B reads as amateur unless done extremely well, and it's slow to build.

### Density
- Comfortable, not compact. This isn't a spreadsheet.
- Generous padding: 16-24px inside cards, 12-16px between rows.
- White space is not wasted space. It's confidence.

---

## 4 · What NOT to build (protects your 55 hours)

Per the "if it isn't in a screen-share, it isn't in scope" rule from `README.md`:

- **No signup or login flows.** The demo tenant is seeded. You show it from an admin-authenticated session.
- **No password reset, no email verification, no 2FA.**
- **No user management, no permissions, no roles.**
- **No settings page of any kind.**
- **No onboarding tour.** The demo *is* the tour. If a tour is necessary, the UI failed.
- **No landing/marketing page.** Prospects open the demo URL directly. The demo *is* the pitch.
- **No dark mode.**
- **No i18n scaffolding.** English + one target language, hardcoded, per demo tenant.

Every item on this list is real. Every one is deferred. Nothing here is deleted.

---

## 5 · Voice of the persona — the interface that isn't visual

**The persona's tone of voice is the interface.** If Aisha writes short warm messages, the whole product feels warm even in a plain text widget. If she writes stiff formal responses, no amount of design polish saves it.

**70% of the perceived quality of this product lives in the words**, not the visuals. The visual UI is the frame; the words are the picture.

### Rules the prompt author holds to
- **Short.** 1–3 sentences most of the time. Long AI replies read as robotic even when correct.
- **Warm, not effusive.** *"Sure, I can help with that"* beats *"I'd be absolutely delighted to assist you today!"*
- **Match the customer's register.** If they type in fragments, reply in fragments. If they're formal, be formal.
- **Answer the actual question first.** Then, and only then, offer the next thing.
- **Use their language.** The vertical's real words. `stylist` not `service provider`. `client` not `user`. `treatment` not `appointment`, if that's what the salon says.
- **Never invent a service or price.** The worst failure mode. A prospect will spot it instantly and it destroys trust in everything else.
- **When you don't know, say so, and offer a human.** Confidence in the boundaries of the role reads as competence.

### Small examples

| Customer says | Good | Bad |
|---|---|---|
| "hours?" | "We're open Tue–Sat 10–7, Sun 11–5. Closed Mondays. Need anything?" | "Our operating hours are Tuesday through Saturday from 10:00 to 19:00, Sunday from 11:00 to 17:00, and we are closed on Mondays. Is there anything else I can assist you with today?" |
| "how much for balayage" | "Balayage is from RM 420, about 3 hours. First time? You'd need a 48h patch test." | "Our balayage service starts at RM 420 and takes approximately 3 hours to complete. For first-time colour clients, we require a patch test 48 hours in advance for your safety." |
| "can you cut it cheaper for me" | "I can't do discounts myself — but I can pass it on to the owner if you'd like." | "Unfortunately I am unable to authorise pricing adjustments." |
| "you're rubbish" | "I'm sorry that landed badly. Let me get a person to help — someone will be in touch shortly." | "I apologise if my responses have been unsatisfactory. Could you provide more details about the issue?" |

The bad versions are grammatically correct and factually right. They're still wrong.

### Tone against the golden set
When scoring `tests/golden.md`, score **tone and appropriateness alongside correctness.** A right answer in the wrong voice is a failure the prospect will feel without being able to name.

---

## 6 · Build order

Not the whole runbook — just the UI slice, in the order it should be built:

1. Chat widget shell — bottom-right bubble, panel, message list, input (Gate 2, task 2.1)
2. First greeting visible on open + typing indicator (Gate 2, task 2.1)
3. Three suggested chips (Gate 2, task 2.3)
4. Session persistence across refresh (Gate 2, task 2.2)
5. Prospect-branded demo page (Gate 2, task 2.4)
6. Dashboard: Conversations list + thread view (Gate 2, task 2.5)
7. Dashboard: Services table with **live recompile** (Gate 2, task 2.7 — the closer)
8. Dashboard: Escalations + Bookings (Gate 2, task 2.6)
9. Mobile pass on a real phone (Gate 2, task 2.12)

Task numbers reference `docs/WORKPLAN.md`. Nothing here adds hours to the plan — this file just tells you *how* to spend the hours already allocated.

---

## 7 · The one test that matters

Before showing anyone: **open it on your phone, in landscape, with the browser bar visible, and try to break it.**

- Can you tap the send button with your thumb?
- Does the keyboard cover the last message?
- Does a long agent reply overflow?
- If you rotate mid-conversation, does the history stay?
- If you close and reopen the widget, is your conversation still there?

If any of these fail, the demo fails — prospects will do exactly this within thirty seconds of you handing over the keyboard.
