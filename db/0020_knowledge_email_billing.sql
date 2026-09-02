-- ============================================================================
-- 0020_knowledge_email_billing.sql
-- Run AFTER 0019. Safe to re-run.
--
--   KNOWLEDGE  the agent knows more than a price list
--   EMAIL      keys, confirmations and alerts actually reach people
--   BILLING    customers can subscribe
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · KNOWLEDGE
--
-- Everything a business knows that isn't a price: policies, FAQs, parking,
-- what to bring, how refunds work. Injected into the prompt as one block.
--
-- No embeddings, deliberately. A small business has a few pages of knowledge,
-- and a few pages fit in the prompt. Retrieval adds a whole failure mode for
-- nothing at this size. Revisit past roughly 6,000 words.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists knowledge (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  title      text not null,
  body       text not null,
  agent_slug text,                       -- null = every agent for this business
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_tenant_idx on knowledge(tenant_id) where is_active;
alter table knowledge enable row level security;

-- Roughly 4 chars per token. Warn well before the prompt gets expensive.
create or replace function knowledge_size(p_tenant uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'entries', count(*),
    'words', coalesce(sum(array_length(regexp_split_to_array(body, '\s+'), 1)), 0),
    'tokens', ceil(coalesce(sum(length(body)), 0) / 4.0))
  from knowledge where tenant_id = p_tenant and is_active;
$$;

create or replace function save_knowledge(p_slug text, p_role text, p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_id uuid := nullif(p_payload->>'id','')::uuid;
begin
  if not guard(p_role, 'settings') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  if nullif(trim(p_payload->>'body'),'') is null then
    return json_build_object('ok', false, 'reason', 'body_required');
  end if;

  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  if v_id is null then
    insert into knowledge (tenant_id, title, body, agent_slug)
    values (v_tenant,
            coalesce(nullif(trim(p_payload->>'title'),''), 'Untitled'),
            trim(p_payload->>'body'),
            nullif(trim(coalesce(p_payload->>'agent_slug','')), ''))
    returning id into v_id;
  else
    update knowledge set
      title = coalesce(nullif(trim(p_payload->>'title'),''), title),
      body = trim(p_payload->>'body'),
      updated_at = now()
    where id = v_id and tenant_id = v_tenant;
    if not found then return json_build_object('ok',false,'reason','unknown_entry'); end if;
  end if;

  perform rebuild_prompt(p_slug);
  return json_build_object('ok', true, 'id', v_id, 'size', knowledge_size(v_tenant));
end; $$;

create or replace function remove_knowledge(p_slug text, p_role text, p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  if not guard(p_role, 'settings') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  select id into v_tenant from tenants where slug = p_slug;
  update knowledge set is_active = false where id = p_id and tenant_id = v_tenant;
  if not found then return json_build_object('ok',false,'reason','unknown_entry'); end if;
  perform rebuild_prompt(p_slug);
  return json_build_object('ok', true);
end; $$;

-- Every template gets a knowledge slot, once.
update ai_employees
   set prompt_template = replace(
         prompt_template,
         'SERVICES AND PRICES' || E'\n' || '{{SERVICES}}',
         'SERVICES AND PRICES' || E'\n' || '{{SERVICES}}' || E'\n\n' ||
         'WHAT ELSE YOU KNOW' || E'\n' || '{{KNOWLEDGE}}')
 where prompt_template like '%{{SERVICES}}%'
   and prompt_template not like '%{{KNOWLEDGE}}%';

update sector_templates
   set prompt_template = replace(
         prompt_template,
         'SERVICES AND PRICES' || E'\n' || '{{SERVICES}}',
         'SERVICES AND PRICES' || E'\n' || '{{SERVICES}}' || E'\n\n' ||
         'WHAT ELSE YOU KNOW' || E'\n' || '{{KNOWLEDGE}}')
 where prompt_template like '%{{SERVICES}}%'
   and prompt_template not like '%{{KNOWLEDGE}}%';

-- rebuild_prompt now fills both slots
create or replace function rebuild_prompt(p_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid; v_agent uuid; v_tpl text; v_services text; v_know text;
  v_prompt text; v_count int; v_version int;
begin
  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  select id, prompt_template into v_agent, v_tpl
  from ai_employees where tenant_id = v_tenant and status='active'
  order by is_primary desc limit 1;

  if v_agent is null then return json_build_object('ok',false,'reason','no_agent'); end if;
  if v_tpl is null then return json_build_object('ok',false,'reason','no_template'); end if;

  select string_agg(
           '- ' || name
           || case when price_local is null then ' (price on enquiry)'
                   else ' — ' || currency_code || ' ' ||
                        trim(to_char(price_local,'FM999999990.00')) end
           || case when duration_minutes is null then ''
                   else ', about ' || duration_minutes || ' minutes' end
           || case when description is null or description = '' then ''
                   else '. ' || description end,
           E'\n' order by price_local nulls last), count(*)
    into v_services, v_count
  from items where tenant_id = v_tenant and is_active;

  select string_agg('## ' || title || E'\n' || body, E'\n\n' order by created_at)
    into v_know
  from knowledge where tenant_id = v_tenant and is_active;

  v_prompt := replace(v_tpl, '{{SERVICES}}', coalesce(v_services, '(none listed)'));
  v_prompt := replace(v_prompt, '{{KNOWLEDGE}}',
                coalesce(v_know, '(nothing added — say you will check and have a colleague follow up)'));

  update ai_employees
     set compiled_prompt = v_prompt,
         compiled_tokens = ceil(length(v_prompt)/4.0),
         config_version = config_version + 1,
         updated_at = now()
   where id = v_agent
  returning config_version into v_version;

  return json_build_object('ok',true,'config_version',v_version,
                           'tokens',ceil(length(v_prompt)/4.0),
                           'services_listed',coalesce(v_count,0));
end; $$;

-- same for the per-agent rebuild
create or replace function rebuild_agent(p_agent_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_tpl text; v_slug text; v_services text; v_know text;
        v_prompt text; v_v int;
begin
  select tenant_id, prompt_template, slug into v_tenant, v_tpl, v_slug
  from ai_employees where id = p_agent_id;
  if v_tpl is null then return json_build_object('ok',false,'reason','no_template'); end if;

  select string_agg(
           '- ' || name
           || case when price_local is null then ' (price on enquiry)'
                   else ' — ' || currency_code || ' ' ||
                        trim(to_char(price_local,'FM999999990.00')) end
           || case when duration_minutes is null then ''
                   else ', about ' || duration_minutes || ' minutes' end,
           E'\n' order by price_local nulls last)
    into v_services
  from items where tenant_id = v_tenant and is_active;

  select string_agg('## ' || title || E'\n' || body, E'\n\n' order by created_at)
    into v_know
  from knowledge
  where tenant_id = v_tenant and is_active
    and (agent_slug is null or agent_slug = v_slug);

  v_prompt := replace(v_tpl, '{{SERVICES}}', coalesce(v_services,'(none listed)'));
  v_prompt := replace(v_prompt, '{{KNOWLEDGE}}',
                coalesce(v_know,'(nothing added — say you will check and have a colleague follow up)'));

  update ai_employees
     set compiled_prompt = v_prompt,
         compiled_tokens = ceil(length(v_prompt)/4.0),
         config_version = config_version + 1,
         updated_at = now()
   where id = p_agent_id
  returning config_version into v_v;

  return json_build_object('ok',true,'config_version',v_v);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · EMAIL LOG
-- What was sent, to whom, and whether it worked. Without this, "did they get
-- their key?" is unanswerable.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists email_log (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references tenants(id) on delete set null,
  to_email   text not null,
  kind       text not null,
  subject    text,
  status     text not null default 'queued',
  error      text,
  sent_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint email_status_chk check (status in ('queued','sent','failed'))
);

create index if not exists email_log_tenant_idx on email_log(tenant_id, created_at desc);
alter table email_log enable row level security;

create or replace function log_email(
  p_tenant uuid, p_to text, p_kind text, p_subject text, p_status text, p_error text
) returns uuid language sql security definer set search_path = public as $$
  insert into email_log (tenant_id, to_email, kind, subject, status, error, sent_at)
  values (p_tenant, p_to, p_kind, p_subject, p_status, p_error,
          case when p_status = 'sent' then now() else null end)
  returning id;
$$;

-- who should be told when something needs a human
create or replace function notify_targets(p_tenant_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'tenant_id', t.id,
    'business', t.name,
    'emails', coalesce(
      (select array_agg(distinct e) from (
         select s.email as e from staff s
          where s.tenant_id = t.id and s.role in ('owner','manager')
            and s.email is not null and s.status = 'active'
         union
         select t.email where t.email is not null and t.email not like '%@%.local'
       ) x where e is not null), '{}')
  ) from tenants t where t.slug = p_tenant_slug;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · BILLING
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  plan               text not null,
  status             text not null default 'trialing',
  provider           text not null default 'stripe',
  provider_customer  text,
  provider_sub       text,
  amount             numeric(10,2),
  currency           text default 'MYR',
  current_period_end timestamptz,
  trial_ends_at      timestamptz,
  cancelled_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint sub_status_chk check (status in
    ('trialing','active','past_due','cancelled','incomplete')),
  unique (tenant_id)
);

alter table subscriptions enable row level security;

create table if not exists plans (
  code       text primary key,
  label      text not null,
  amount     numeric(10,2) not null,
  currency   text not null default 'MYR',
  interval   text not null default 'month',
  features   text[] not null default '{}',
  sort       int not null default 0,
  is_active  boolean not null default true
);

insert into plans (code, label, amount, features, sort) values
  ('trial',    'Trial',    0,   array['Your own branded page','Unlimited conversations','Bookings and dashboard','14 days, no card'], 0),
  ('standard', 'Standard', 149, array['Everything in Trial','Your own domain','Priority replies','Email support'], 1),
  ('multi',    'Multi',    399, array['Everything in Standard','Up to 5 businesses','One dashboard for all','Onboarding call'], 2)
on conflict (code) do update set
  label = excluded.label, amount = excluded.amount, features = excluded.features;

-- every business starts on a 14-day trial
create or replace function ensure_subscription(p_tenant uuid)
returns void language sql security definer set search_path = public as $$
  insert into subscriptions (tenant_id, plan, status, trial_ends_at)
  values (p_tenant, 'trial', 'trialing', now() + interval '14 days')
  on conflict (tenant_id) do nothing;
$$;

create or replace function set_subscription(p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  select id into v_tenant from tenants where slug = p_payload->>'slug';
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  perform ensure_subscription(v_tenant);

  update subscriptions set
    plan               = coalesce(nullif(p_payload->>'plan',''), plan),
    status             = coalesce(nullif(p_payload->>'status',''), status),
    provider_customer  = coalesce(nullif(p_payload->>'customer',''), provider_customer),
    provider_sub       = coalesce(nullif(p_payload->>'subscription',''), provider_sub),
    amount             = coalesce(nullif(p_payload->>'amount','')::numeric, amount),
    current_period_end = coalesce(nullif(p_payload->>'period_end','')::timestamptz, current_period_end),
    cancelled_at       = case when p_payload->>'status' = 'cancelled' then now() else cancelled_at end,
    updated_at         = now()
  where tenant_id = v_tenant;

  update tenants set plan = coalesce(nullif(p_payload->>'plan',''), plan),
                     status = case when p_payload->>'status' = 'active' then 'active' else status end
  where id = v_tenant;

  return json_build_object('ok', true);
end; $$;

create or replace function billing_state(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'ok', true,
    'subscription', (select json_build_object(
        'plan',s.plan,'status',s.status,'amount',s.amount,'currency',s.currency,
        'trial_ends_at',s.trial_ends_at,'period_end',s.current_period_end)
      from subscriptions s join tenants t on t.id = s.tenant_id where t.slug = p_slug),
    'plans', (select coalesce(json_agg(json_build_object(
        'code',code,'label',label,'amount',amount,'currency',currency,'features',features)
        order by sort), '[]'::json) from plans where is_active)
  );
$$;

-- give the businesses that already exist a trial row
do $$ declare r record; begin
  for r in select id from tenants loop perform ensure_subscription(r.id); end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · Wire the new actions into the role guard
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function guarded_action(
  p_slug text, p_role text, p_action text, p_payload json
) returns json language plpgsql security definer set search_path = public as $$
declare v_need text;
begin
  v_need := case p_action
    when 'price'              then 'edit_prices'
    when 'save_item'          then 'edit_prices'
    when 'remove_item'        then 'edit_prices'
    when 'resolve_escalation' then 'handle_chats'
    when 'booking_status'     then 'manage_bookings'
    when 'save_post'          then 'marketing'
    when 'set_post_status'    then 'marketing'
    when 'invoice'            then 'finance'
    when 'invoice_status'     then 'finance'
    when 'add_staff'          then 'manage_team'
    when 'set_staff'          then 'manage_team'
    when 'add_agent'          then 'settings'
    when 'branding'           then 'settings'
    when 'hours'              then 'settings'
    when 'save_knowledge'     then 'settings'
    when 'remove_knowledge'   then 'settings'
    else 'view' end;

  if not guard(p_role, v_need) then
    return json_build_object('ok',false,'reason','not_allowed',
                             'needs',v_need,'your_role',p_role);
  end if;

  return case p_action
    when 'price'              then update_item_price((p_payload->>'id')::uuid,
                                                     (p_payload->>'price')::numeric)
    when 'save_item'          then save_item(p_slug, p_role, p_payload)
    when 'remove_item'        then remove_item(p_slug, p_role, (p_payload->>'id')::uuid)
    when 'resolve_escalation' then resolve_escalation((p_payload->>'id')::uuid)
    when 'booking_status'     then set_booking_status((p_payload->>'id')::uuid, p_payload->>'status')
    when 'save_post'          then save_post(p_slug, p_payload)
    when 'set_post_status'    then set_post_status((p_payload->>'id')::uuid, p_payload->>'status')
    when 'invoice'            then invoice_for_booking((p_payload->>'id')::uuid)
    when 'invoice_status'     then set_invoice_status((p_payload->>'id')::uuid,
                                                      p_payload->>'status', null)
    when 'add_staff'          then add_staff(p_slug, p_payload)
    when 'set_staff'          then set_staff((p_payload->>'id')::uuid,
                                             coalesce(p_payload->>'role',''),
                                             coalesce(p_payload->>'status',''))
    when 'add_agent'          then add_agent(p_slug, p_payload)
    when 'branding'           then update_branding(p_slug, p_role, p_payload)
    when 'hours'              then update_hours(p_slug, p_role, (p_payload->>'hours')::jsonb)
    when 'save_knowledge'     then save_knowledge(p_slug, p_role, p_payload)
    when 'remove_knowledge'   then remove_knowledge(p_slug, p_role, (p_payload->>'id')::uuid)
    else json_build_object('ok',false,'reason','unknown_action')
  end;
end; $$;

-- platform_data carries knowledge and billing too
create or replace function platform_data(p_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_result json;
begin
  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  perform ensure_social_rows(v_tenant);
  perform ensure_subscription(v_tenant);

  select json_build_object(
    'ok', true,
    'business', (select json_build_object(
        'name',t.name,'slug',t.slug,'color',coalesce(t.brand_color,'#1D6A8C'),
        'plan',t.plan,'wallet',t.wallet_balance_usd,'domain',t.custom_domain,
        'tagline',t.tagline,'address',t.address,'phone',t.phone,'map_url',t.map_url,
        'greeting',t.brand_greeting,'suggestions',t.brand_suggestions,
        'hours',t.opening_hours,'logo_url',t.logo_url,'access_code',t.access_code,
        'email',t.email)
      from tenants t where t.id = v_tenant),
    'items', (select coalesce(json_agg(i order by i.price nulls last),'[]'::json) from (
        select id, name, description, price_local as price, currency_code as currency,
               duration_minutes as minutes
        from items where tenant_id = v_tenant and is_active order by price_local nulls last) i),
    'knowledge', (select coalesce(json_agg(k order by k.created_at),'[]'::json) from (
        select id, title, body, agent_slug, created_at from knowledge
        where tenant_id = v_tenant and is_active order by created_at) k),
    'knowledge_size', knowledge_size(v_tenant),
    'agents', list_agents(p_slug),
    'team', (select coalesce(json_agg(s order by s.role, s.name),'[]'::json) from (
        select id, name, email, role, status, access_code from staff
        where tenant_id = v_tenant order by role, name) s),
    'social', (select coalesce(json_agg(a order by a.platform),'[]'::json) from (
        select id, platform, handle, status, followers from social_accounts
        where tenant_id = v_tenant) a),
    'posts', (select coalesce(json_agg(p order by p.created_at desc),'[]'::json) from (
        select id, body, platforms, status, scheduled_at, published_at, reach, clicks
        from posts where tenant_id = v_tenant order by created_at desc limit 30) p),
    'invoices', (select coalesce(json_agg(i order by i.issued_on desc),'[]'::json) from (
        select inv.id, inv.number, inv.amount, inv.currency, inv.status, inv.issued_on,
               coalesce(c.name,'Walk-in') as customer
        from invoices inv left join customers c on c.id = inv.customer_id
        where inv.tenant_id = v_tenant order by inv.issued_on desc limit 30) i),
    'finance', (select json_build_object(
        'paid',coalesce(sum(amount) filter (where status='paid'),0),
        'unpaid',coalesce(sum(amount) filter (where status='unpaid'),0),
        'count',count(*)) from invoices where tenant_id = v_tenant),
    'billing', billing_state(p_slug),
    'stats', (select json_build_object(
        'conversations',(select count(*) from conversations where tenant_id = v_tenant),
        'bookings',(select count(*) from bookings where tenant_id = v_tenant
                     and status in ('pending','confirmed')),
        'needs_you',(select count(*) from escalations where tenant_id = v_tenant
                      and status='open')))
  ) into v_result;

  return v_result;
end; $$;

revoke execute on function
  save_knowledge(text,text,json), remove_knowledge(text,text,uuid),
  set_subscription(json), billing_state(text), log_email(uuid,text,text,text,text,text),
  notify_targets(text), ensure_subscription(uuid), knowledge_size(uuid)
  from public, anon, authenticated;

grant execute on function
  save_knowledge(text,text,json), remove_knowledge(text,text,uuid),
  set_subscription(json), billing_state(text), log_email(uuid,text,text,text,text,text),
  notify_targets(text), ensure_subscription(uuid), knowledge_size(uuid)
  to service_role;

-- ============================================================================
-- CHECK
--   select save_knowledge('damai-clinic','owner',
--     '{"title":"Parking","body":"Free parking behind the building. Enter from Jalan SS15/4."}'::json);
--   → then ask the agent "do you have parking?" — it should answer, not deflect
--
--   select knowledge_size((select id from tenants where slug='damai-clinic'));
--   select billing_state('damai-clinic');
--   select notify_targets('damai-clinic');
-- ============================================================================
