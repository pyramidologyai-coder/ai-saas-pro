# Setup — first hour

Follow in order. Stop at anything that fails; don't work around it.

## 1 · Repo (10 min)

```bash
git init
git add .
git commit -m "skeleton: schema, compiler, runtime contract, work plan"
git remote add origin git@github.com:<you>/automology.git
git push -u origin main
npm install
```

## 2 · Database (20 min)

Use a **scratch** Supabase project, not production. These migrations have been
checked as valid Postgres but have never been executed.

1. Supabase → SQL Editor → paste `db/0001_init.sql` → Run
2. Same for `db/0002_seed.sql`
3. Table Editor → confirm 11 tables and "Sunrise Hair Studio"

## 3 · Isolation test (10 min) — do not skip

```sql
-- create a second tenant
insert into tenants (name, slug, email, vertical)
values ('Test Two', 'test-two', 'b@example.com', 'salon');

-- then, signed in as a user belonging to tenant A:
select count(*) from conversations
where tenant_id = '<tenant-B-id>';
-- MUST return 0
```

If this returns rows, stop everything and fix RLS. A cross-tenant leak is the
one failure that ends the company rather than costing a customer.

## 4 · Compiler (10 min)

```bash
pip install pyyaml
python scripts/compile.py --agent AGENT-001 --sector salon \
  --tenant scripts/tenants/sunrise-salon.json
```

Expect roughly 620 tokens and a short conflict list. Then:

```bash
python scripts/compile.py --agent AGENT-001 --diff clinic salon
```

Expect ~42% similarity — proof the sector layer does real work.

Paste the compiled prompt into `ai_employees.compiled_prompt` for the demo
tenant, and set `compiled_tokens`.

## 5 · Vercel (10 min)

Connect the repo. Add the environment variables from `.env.example`.
Deploy. A blank page is a fine result — you are proving the pipe works.

---

## Done when

- [ ] Repo pushed
- [ ] 11 tables exist
- [ ] Cross-tenant query returns 0 rows
- [ ] Compiler prints a token count
- [ ] `compiled_prompt` is populated for the demo tenant
- [ ] Vercel deploys on push

That is Gate 0. Next: `docs/WORKPLAN.md`, Gate 1.
