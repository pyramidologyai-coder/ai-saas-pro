# START HERE — exactly what to do, in order

You have one file to download: **`automology-repo.zip`**.
Everything below uses only what's inside it. Follow top to bottom.

---

## PART A — The 25 files you are pushing to GitHub

These are all inside `automology-repo.zip`. You don't create any of them —
you unzip and push. Here's what each one is, so nothing is a mystery.

### Root
| File | What it is |
|---|---|
| `README.md` | What the project is + what actually exists today |
| `RUNBOOK.md` | The ordered checklist you work through |
| `.env.example` | Template for your secret keys (copy to `.env.local`) |
| `.gitignore` | Tells git what not to upload |
| `package.json` | The list of code libraries to install |

### `agents/` — the AI's brain, in layers
| File | What it is |
|---|---|
| `agents/AGENT-001-receptionist.md` | What a receptionist is (the base role) |
| `agents/sectors/salon.yaml` | How a salon differs |
| `agents/sectors/clinic.yaml` | How a clinic differs (reference) |

### `schemas/` — the rules those files must follow
| File | What it is |
|---|---|
| `schemas/ROLE_SPEC.schema.json` | Shape of a role file |
| `schemas/SECTOR_PATCH.schema.json` | Shape of a sector file |

### `db/` — your database
| File | What it is |
|---|---|
| `db/0001_init.sql` | Creates the 11 tables. Run first. |
| `db/0002_seed.sql` | Adds the demo salon. Run second. |

### `lib/` — the working code
| File | What it is |
|---|---|
| `lib/compile.ts` | Merges the 3 layers into one prompt |
| `lib/llm.ts` | Talks to the AI model, tracks cost |
| `lib/supabase.ts` | Talks to the database |

### `app/` — the thing users touch
| File | What it is |
|---|---|
| `app/api/chat/route.ts` | The brain: message in, answer out |

### `scripts/` — the reference compiler
| File | What it is |
|---|---|
| `scripts/compile.py` | Working Python compiler (proven) |
| `scripts/tenants/sunrise-salon.json` | Example business config |

### `tests/`
| File | What it is |
|---|---|
| `tests/golden.md` | 30 questions that define "working" |

### `docs/`
| File | What it is |
|---|---|
| `docs/SETUP.md` | The first-hour setup guide |
| `docs/WORKPLAN.md` | Full gate-by-gate task list |
| `docs/DECISIONS.md` | Where you write the vertical + price |
| `docs/RUNTIME.md` | The 9 steps a message goes through |
| `docs/RUNTIME_DATA_FLOW_full.md` | The full 22-step design (reference) |
| `docs/UI_UX.md` | Widget rules, dashboard rules, tone of voice |
| `docs/LSS_PROJECT_A3.html` | The LSS project on one page |

---

## PART B — What to ARCHIVE (your OLD repo)

Your **old** repo is the one with 242 files. You are not touching the new repo
here. You have two options — pick one:

**Easiest (recommended):** On GitHub, open your old repo →
**Settings** → rename it to `automology-archive`. Done. Nothing deleted,
it's parked. The six files you needed from it are already inside the new zip.

**If you'd rather keep one repo:** in your old repo folder on your computer:
```bash
cd ~/path/to/your-OLD-repo
mkdir archive
git mv * archive/
git add -A
git commit -m "Archive superseded specs; clean MVP is the new repo"
git push
```

Either way: **nothing is deleted.** You lose nothing.

---

## PART C — Push the NEW repo. Step by step.

### Step 1 — unzip
Download `automology-repo.zip`, then:
```bash
cd ~/Downloads
unzip automology-repo.zip
cd repo
```

### Step 2 — make the empty GitHub repo
Go to github.com → **New repository** → name it `automology` →
**do not** tick "Add README" or ".gitignore" (the zip has them) → **Create**.
GitHub shows you a page with a URL like
`https://github.com/YOURNAME/automology.git`. Keep it open.

### Step 3 — push
In the `repo` folder from Step 1:
```bash
git init
git add .
git commit -m "MVP skeleton: schema, compiler, runtime, docs"
git branch -M main
git remote add origin https://github.com/YOURNAME/automology.git
git push -u origin main
```
Replace `YOURNAME`. Refresh the GitHub page — all 25 files are there.

---

## PART D — Run the database. Step by step.

### Step 4 — create the project
supabase.com → **New project** → name it `automology-dev`. Wait for it to
finish setting up.

### Step 5 — run the two SQL files
Left sidebar → **SQL Editor** → **New query**.
Open `db/0001_init.sql`, copy ALL of it, paste, click **Run**.
Then New query again, open `db/0002_seed.sql`, copy all, paste, **Run**.

### Step 6 — check it worked
Left sidebar → **Table Editor**. You should see **11 tables** and, inside
`tenants`, a row called **Sunrise Hair Studio**.

### Step 7 — the isolation test (do not skip)
This proves one business can't read another's data. SQL Editor → New query:
```sql
-- make a second business
insert into tenants (name, slug, email, vertical)
values ('Test Two', 'test-two', 'b@example.com', 'salon');

-- copy its id from the result, then:
select count(*) from conversations
where tenant_id = 'PASTE-TEST-TWO-ID-HERE';
```
It must return **0**. If it does, your data is safe. Move on.
If it returns anything else, stop and tell me.

---

## PART E — The two decisions (30 min, both of you)

Open `docs/DECISIONS.md`. Fill the blanks in:
- **ADR-002** — which vertical (salon? restaurant? gym? clinic comes later)
- **ADR-003** — the price (one number; $79–149/mo is a sane start)

This is the meeting you missed. Two answers. Write them in the file, commit,
push:
```bash
git add docs/DECISIONS.md
git commit -m "Decide vertical and price"
git push
```

---

## That's Gate 0. You're done when:

- [ ] New repo pushed to GitHub (25 files visible)
- [ ] Old repo archived or renamed
- [ ] 11 tables live in Supabase
- [ ] Isolation test returns 0
- [ ] Vertical + price written in DECISIONS.md

Then open `RUNBOOK.md` and start Gate 1.

---

## If you only do three things this week
1. **Both:** the two decisions (Part E) — 30 minutes, unblocks everything.
2. **Dev:** push the repo + run the database + isolation test (Parts C, D).
3. **Second:** fill `tests/golden.md` with your vertical's real prices.

Tell me your vertical and price and I'll rewrite the seed data, the golden
tests and the demo config to match, so your partner can start without waiting.
