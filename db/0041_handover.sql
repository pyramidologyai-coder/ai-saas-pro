-- ============================================================================
-- 0041_handover.sql — one agent hands a conversation to another.
-- Run AFTER 0040. Safe to re-run.
--
-- WHY
-- A business can run several agents — a receptionist, an internal HR agent, an
-- owner-insights agent. Until now none of them could pass a conversation to
-- another: the receptionist that hit a question outside its remit had nowhere
-- to send it. Handover was designed (the tag is in CLAUDE.md) and never built.
--
-- THE RULE, in the database and not the prompt
-- A public agent talks to anonymous customers and knows only published things.
-- An internal agent knows staff-only material. A public agent must never hand a
-- customer to an internal one — a prompt can be talked into it, a check cannot.
-- handover() below refuses that move, and public_colleagues() only ever lists
-- public agents, so a public agent is not even told the internal ones exist.
--
-- Continuity uses conversations.ai_employee_id, which already exists: a handover
-- points it at the new agent, and the chat route follows it on the next message.
-- ============================================================================

create table if not exists handovers (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  from_agent_id   uuid references ai_employees(id) on delete set null,
  to_agent_id     uuid references ai_employees(id) on delete set null,
  reason          text,
  created_at      timestamptz not null default now()
);

create index if not exists handovers_tenant_idx on handovers(tenant_id);
create index if not exists handovers_conversation_idx on handovers(conversation_id);

alter table handovers enable row level security;
alter table handovers force row level security;
drop policy if exists tenant_isolation on handovers;
create policy tenant_isolation on handovers for all
  using (tenant_id = current_tenant())
  with check (tenant_id = current_tenant());

-- ─────────────────────────────────────────────────────────────────────────────
-- Who an agent may hand to. Public agents only, so the model is never even told
-- an internal agent exists. This is the list injected into the prompt.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public_colleagues(p_agent_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(json_build_object(
      'slug',       e2.slug,
      'name',       e2.persona_name,
      'department', coalesce(e2.department, 'Front desk')
    ) order by e2.persona_name), '[]'::json)
  from ai_employees e1
  join ai_employees e2 on e2.tenant_id = e1.tenant_id
  where e1.id = p_agent_id
    and e2.id <> e1.id
    and e2.status = 'active'
    and e2.audience = 'public'
    and e2.slug is not null;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Perform a handover. Validates the target, enforces the public→internal block,
-- points the conversation at the new agent, and logs it. Returns the target's
-- details so the chat route can introduce them, or a reason it refused.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function handover(p_conversation_id uuid, p_from_agent uuid,
                                    p_to_slug text, p_reason text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_tenant uuid; v_from_aud text; v_to ai_employees%rowtype;
begin
  select tenant_id into v_tenant from conversations where id = p_conversation_id;
  if v_tenant is null then
    return json_build_object('ok', false, 'reason', 'no_conversation');
  end if;

  select audience into v_from_aud from ai_employees where id = p_from_agent;

  select * into v_to from ai_employees
   where tenant_id = v_tenant and slug = p_to_slug
   limit 1;

  if v_to.id is null then
    return json_build_object('ok', false, 'reason', 'unknown_agent');
  end if;
  if v_to.status <> 'active' then
    return json_build_object('ok', false, 'reason', 'inactive_agent');
  end if;

  -- THE RULE. Public may not hand a customer to internal. A missing from-agent
  -- audience is treated as public, the stricter reading.
  if coalesce(v_from_aud, 'public') = 'public' and v_to.audience = 'internal' then
    return json_build_object('ok', false, 'reason', 'public_to_internal_blocked');
  end if;

  update conversations set ai_employee_id = v_to.id where id = p_conversation_id;

  insert into handovers (tenant_id, conversation_id, from_agent_id, to_agent_id, reason)
  values (v_tenant, p_conversation_id, p_from_agent, v_to.id, nullif(trim(p_reason), ''));

  return json_build_object('ok', true, 'to_agent_id', v_to.id,
                           'name', v_to.persona_name,
                           'department', coalesce(v_to.department, 'Front desk'),
                           'audience', v_to.audience);
end; $$;

revoke execute on function public_colleagues(uuid)            from public, anon, authenticated;
revoke execute on function handover(uuid, uuid, text, text)   from public, anon, authenticated;
grant  execute on function public_colleagues(uuid)            to service_role;
grant  execute on function handover(uuid, uuid, text, text)   to service_role;

-- ============================================================================
-- CHECK
--   damai-clinic has a public agent (nadia) and an internal one (rami).
--
--   -- public → internal must be refused:
--   select handover(
--     (select id from conversations where tenant_id=(select id from tenants where slug='damai-clinic') limit 1),
--     (select id from ai_employees where slug='nadia' and tenant_id=(select id from tenants where slug='damai-clinic')),
--     'rami', 'trying to reach payroll');
--   → {"ok": false, "reason": "public_to_internal_blocked"}
--
--   -- a public agent is only told about public colleagues:
--   select public_colleagues(
--     (select id from ai_employees where slug='nadia' and tenant_id=(select id from tenants where slug='damai-clinic')));
--   → rami must NOT appear
-- ============================================================================
