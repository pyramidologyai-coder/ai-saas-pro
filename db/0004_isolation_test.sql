-- ============================================================================
-- 0004_isolation_test.sql — proves tenant A cannot read tenant B.
-- Run AFTER 0001, 0002, 0003. Safe to run many times.
--
-- This is the one test that matters. A cross-tenant leak is the failure
-- that ends the company. Run it before building anything on top.
--
-- HOW TO READ THE RESULT: the last query prints one row per check with
-- PASS or FAIL. Everything must say PASS.
-- ============================================================================

-- 1 · Create a second tenant (idempotent — safe if it already exists)
insert into tenants (name, slug, email, vertical, status)
values ('Isolation Test Co', 'isolation-test', 'isolation@example.com', 'salon', 'active')
on conflict (slug) do nothing;

-- 1b · Give the test tenant an AI employee (conversations require one)
insert into ai_employees (tenant_id, agent_id, sector_id, persona_name, status)
select id, 'AGENT-001', 'salon', 'Test Agent', 'active'
from tenants where slug = 'isolation-test'
  and not exists (select 1 from ai_employees e where e.tenant_id = tenants.id);

-- 2 · Give each tenant one conversation-worth of data
--     (customer + conversation for BOTH tenants, so a leak has something to leak)
with t as (
  select id, slug from tenants where slug in ('sunrise-hair', 'isolation-test')
),
c as (
  insert into customers (tenant_id, external_id, name)
  select id, 'isotest-' || slug, 'Isolation Probe'
  from t
  on conflict (tenant_id, external_id) do update set name = excluded.name
  returning id, tenant_id
)
insert into conversations (tenant_id, ai_employee_id, customer_id, channel)
select c.tenant_id,
       (select id from ai_employees e where e.tenant_id = c.tenant_id limit 1),
       c.id, 'webchat'
from c
where not exists (
  select 1 from conversations x
  where x.tenant_id = c.tenant_id and x.customer_id = c.id
);

-- 3 · The checks.
--     RLS policies key off auth_tenant_id(), which reads the logged-in user's
--     profile. In the SQL editor you are 'postgres' (superuser) — RLS does NOT
--     apply to you, so we test the policies by simulating an anon/authenticated
--     request with a forged JWT claim, the same way PostgREST does.

-- ---------------------------------------------------------------------------
-- CHECK A: an anonymous request (no login) sees NOTHING in any tenant table.
-- ---------------------------------------------------------------------------
set local role anon;
select 'A1: anon sees 0 tenants'        as check, case when count(*) = 0 then 'PASS' else 'FAIL' end as result from tenants
union all
select 'A2: anon sees 0 conversations', case when count(*) = 0 then 'PASS' else 'FAIL' end from conversations
union all
select 'A3: anon sees 0 messages',      case when count(*) = 0 then 'PASS' else 'FAIL' end from messages
union all
select 'A4: anon sees 0 customers',     case when count(*) = 0 then 'PASS' else 'FAIL' end from customers;
reset role;

-- ---------------------------------------------------------------------------
-- CHECK B: a logged-in user of tenant A sees ONLY tenant A's rows.
-- We forge the JWT the way Supabase would present it, with a profile row
-- linking a fake user to sunrise-hair.
-- ---------------------------------------------------------------------------

-- 3b.1 create a fake auth user + profile for sunrise-hair (idempotent)
--      NOTE: inserting into auth.users directly is fine in a dev project.
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000aaaa', 'iso-user-a@example.com')
on conflict (id) do nothing;

insert into profiles (id, tenant_id, full_name, email, role)
select '00000000-0000-0000-0000-00000000aaaa', id, 'Iso User A',
       'iso-user-a@example.com', 'owner'
from tenants where slug = 'sunrise-hair'
on conflict (id) do nothing;

-- 3b.2 simulate that user's request
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000aaaa","role":"authenticated"}';

select 'B1: user A sees exactly 1 tenant' as check,
       case when count(*) = 1 then 'PASS' else 'FAIL' end as result
from tenants
union all
select 'B2: user A sees 0 rows of Isolation Test Co',
       case when count(*) = 0 then 'PASS' else 'FAIL' end
from conversations
where tenant_id = (select id from tenants where slug = 'isolation-test')
union all
select 'B3: user A conversations are all their own',
       case when count(*) = 0 then 'PASS' else 'FAIL' end
from conversations
where tenant_id <> (select tenant_id from profiles
                    where id = '00000000-0000-0000-0000-00000000aaaa');

reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- Every row above must say PASS.
--   All PASS → your data isolation works. Continue to Gate 1.
--   Any FAIL → STOP. Do not build further. Copy the FAIL row + your schema
--              version and debug the RLS policy for that table.
-- ---------------------------------------------------------------------------

-- Optional cleanup (leaves real seed data alone):
-- delete from conversations where customer_id in (select id from customers where external_id like 'isotest-%');
-- delete from customers where external_id like 'isotest-%';
-- delete from profiles where id = '00000000-0000-0000-0000-00000000aaaa';
-- delete from auth.users where id = '00000000-0000-0000-0000-00000000aaaa';
-- delete from tenants where slug = 'isolation-test';
