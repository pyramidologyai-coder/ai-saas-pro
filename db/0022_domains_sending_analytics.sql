-- ============================================================================
-- 0022_domains_sending_analytics.sql
-- Run AFTER 0021. Safe to re-run.
--
--   DOMAINS    a business's page on their own domain, actually routed
--   SENDING    the queue that turns automations into delivered messages
--   ANALYTICS  what customers ask, what converts
--   LIMITS     stop /start being a free-for-all
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · CUSTOM DOMAINS
--
-- Until now the domain box saved nothing. This makes it real: a business
-- claims a hostname, we hand them a DNS record, and once it points at us the
-- middleware serves their page on it.
--
-- Two steps, because domains fail in boring ways:
--   pending    they've claimed it, DNS isn't pointing here yet
--   live       we've seen a request arrive on it
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists domains (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  hostname    text not null unique,
  status      text not null default 'pending',
  verify_token text not null,
  first_seen_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint domain_status_chk check (status in ('pending','live','failed','removed'))
);

create index if not exists domains_host_idx on domains(lower(hostname)) where status <> 'removed';
alter table domains enable row level security;

create or replace function claim_domain(p_slug text, p_role text, p_hostname text)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_host text; v_token text; v_id uuid;
begin
  if not guard(p_role, 'settings') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  -- normalise: no scheme, no path, no trailing dot, lowercase
  v_host := lower(trim(coalesce(p_hostname, '')));
  v_host := regexp_replace(v_host, '^https?://', '');
  v_host := split_part(v_host, '/', 1);
  v_host := rtrim(v_host, '.');

  if v_host !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
    return json_build_object('ok', false, 'reason', 'bad_hostname');
  end if;
  if v_host like '%.vercel.app' then
    return json_build_object('ok', false, 'reason', 'reserved_hostname');
  end if;

  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  if exists (select 1 from domains d
              where lower(d.hostname) = v_host and d.tenant_id <> v_tenant
                and d.status <> 'removed') then
    return json_build_object('ok', false, 'reason', 'taken');
  end if;

  v_token := 'automology-verify=' ||
    substr(translate(encode(gen_random_bytes(12),'base64'),'+/=','xyz'), 1, 16);

  insert into domains (tenant_id, hostname, verify_token)
  values (v_tenant, v_host, v_token)
  on conflict (hostname) do update
    set status = 'pending', verify_token = excluded.verify_token
  returning id into v_id;

  update tenants set custom_domain = v_host where id = v_tenant;

  return json_build_object('ok', true, 'hostname', v_host, 'token', v_token,
    'cname', 'cname.vercel-dns.com');
end; $$;

create or replace function remove_domain(p_slug text, p_role text, p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  if not guard(p_role, 'settings') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  select id into v_tenant from tenants where slug = p_slug;
  update domains set status = 'removed' where id = p_id and tenant_id = v_tenant;
  if not found then return json_build_object('ok',false,'reason','unknown_domain'); end if;
  update tenants set custom_domain = null where id = v_tenant;
  return json_build_object('ok', true);
end; $$;

-- the middleware asks this on every request that isn't on our own host
create or replace function tenant_for_host(p_host text)
returns json language plpgsql security definer set search_path = public as $$
declare v_host text := lower(split_part(trim(coalesce(p_host,'')), ':', 1)); v_row record;
begin
  if v_host = '' then return json_build_object('ok', false); end if;

  select d.id, d.status, t.slug into v_row
  from domains d join tenants t on t.id = d.tenant_id
  where lower(d.hostname) = v_host and d.status in ('pending','live')
  limit 1;

  if not found then return json_build_object('ok', false); end if;

  -- first request on this hostname means DNS is working
  if v_row.status = 'pending' then
    update domains set status = 'live', first_seen_at = now() where id = v_row.id;
  end if;

  return json_build_object('ok', true, 'slug', v_row.slug);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · SEND QUEUE
--
-- Automations and broadcasts wrote rows nobody ever read. This is the outbox
-- a scheduled worker drains. Rows are claimed before sending so two workers
-- running at once can't send the same message twice.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists outbox (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  customer_id  uuid references customers(id) on delete set null,
  booking_id   uuid references bookings(id) on delete set null,
  source       text not null,
  channel      text not null default 'email',
  to_address   text not null,
  subject      text,
  body         text not null,
  send_after   timestamptz not null default now(),
  status       text not null default 'pending',
  attempts     int not null default 0,
  claimed_at   timestamptz,
  sent_at      timestamptz,
  error        text,
  created_at   timestamptz not null default now(),
  constraint outbox_status_chk check (status in ('pending','claimed','sent','failed','cancelled'))
);

create index if not exists outbox_due_idx on outbox(status, send_after);
-- one message per booking per rule, ever
create unique index if not exists outbox_once_idx
  on outbox(booking_id, source) where booking_id is not null;
alter table outbox enable row level security;

-- Fill the outbox from the automation rules. Idempotent — safe every minute.
create or replace function queue_automations()
returns json language plpgsql security definer set search_path = public as $$
declare v_queued int := 0; v_n int;
begin
  -- reminders before an appointment
  insert into outbox (tenant_id, customer_id, booking_id, source, to_address, subject, body, send_after)
  select b.tenant_id, b.customer_id, b.id, 'booking_reminder',
         c.email, 'Reminder: your appointment at ' || t.name,
         coalesce(a.body, 'Reminder: your appointment is coming up.'),
         b.scheduled_at + make_interval(hours => a.offset_hours)
  from bookings b
  join automations a on a.tenant_id = b.tenant_id and a.kind = 'booking_reminder' and a.is_on
  join tenants t on t.id = b.tenant_id
  join customers c on c.id = b.customer_id
  where b.status in ('pending','confirmed')
    and c.email is not null and coalesce(c.opted_out,false) = false
    and b.scheduled_at + make_interval(hours => a.offset_hours) between now() - interval '1 hour'
                                                                   and now() + interval '7 days'
  on conflict do nothing;
  get diagnostics v_n = row_count; v_queued := v_queued + v_n;

  -- follow up after a no-show
  insert into outbox (tenant_id, customer_id, booking_id, source, to_address, subject, body, send_after)
  select b.tenant_id, b.customer_id, b.id, 'no_show_followup',
         c.email, 'We missed you at ' || t.name,
         coalesce(a.body, 'We missed you today. Would you like to rebook?'),
         b.scheduled_at + make_interval(hours => a.offset_hours)
  from bookings b
  join automations a on a.tenant_id = b.tenant_id and a.kind = 'no_show_followup' and a.is_on
  join tenants t on t.id = b.tenant_id
  join customers c on c.id = b.customer_id
  where b.status = 'no_show'
    and c.email is not null and coalesce(c.opted_out,false) = false
  on conflict do nothing;
  get diagnostics v_n = row_count; v_queued := v_queued + v_n;

  -- ask for a review after a completed visit
  insert into outbox (tenant_id, customer_id, booking_id, source, to_address, subject, body, send_after)
  select b.tenant_id, b.customer_id, b.id, 'review_request',
         c.email, 'Thanks for visiting ' || t.name,
         coalesce(a.body, 'Thanks for coming in.'),
         b.scheduled_at + make_interval(hours => a.offset_hours)
  from bookings b
  join automations a on a.tenant_id = b.tenant_id and a.kind = 'review_request' and a.is_on
  join tenants t on t.id = b.tenant_id
  join customers c on c.id = b.customer_id
  where b.status = 'completed'
    and c.email is not null and coalesce(c.opted_out,false) = false
  on conflict do nothing;
  get diagnostics v_n = row_count; v_queued := v_queued + v_n;

  -- broadcasts that are due
  insert into outbox (tenant_id, customer_id, source, to_address, subject, body, send_after)
  select br.tenant_id, c.id, 'broadcast:' || br.id, c.email,
         'A message from ' || t.name, br.body, br.scheduled_at
  from broadcasts br
  join tenants t on t.id = br.tenant_id
  join customers c on c.tenant_id = br.tenant_id
  where br.status = 'queued' and br.scheduled_at <= now() + interval '5 minutes'
    and c.email is not null and coalesce(c.opted_out,false) = false
    and case br.audience
      when 'recent' then exists (select 1 from bookings b where b.customer_id = c.id
                                   and b.scheduled_at > now() - interval '90 days')
      when 'lapsed' then not exists (select 1 from bookings b where b.customer_id = c.id
                                       and b.scheduled_at > now() - interval '180 days')
      when 'no_show' then exists (select 1 from bookings b where b.customer_id = c.id
                                    and b.status = 'no_show')
      else true end
  on conflict do nothing;
  get diagnostics v_n = row_count; v_queued := v_queued + v_n;

  update broadcasts set status = 'sending'
   where status = 'queued' and scheduled_at <= now() + interval '5 minutes';

  return json_build_object('ok', true, 'queued', v_queued);
end; $$;

-- Claim a batch. Claiming and sending are separate so a crash mid-send
-- doesn't lose the row or send it twice.
create or replace function claim_outbox(p_limit int default 25)
returns json language plpgsql security definer set search_path = public as $$
declare v_rows json;
begin
  -- anything claimed but not finished within 10 minutes is retried
  update outbox set status = 'pending', claimed_at = null
   where status = 'claimed' and claimed_at < now() - interval '10 minutes';

  with picked as (
    select id from outbox
     where status = 'pending' and send_after <= now() and attempts < 3
     order by send_after
     limit p_limit
     for update skip locked
  )
  update outbox o set status = 'claimed', claimed_at = now(), attempts = o.attempts + 1
    from picked p where o.id = p.id
  returning json_build_object('id',o.id,'to',o.to_address,'subject',o.subject,
                              'body',o.body,'source',o.source,'tenant_id',o.tenant_id)
  into v_rows;

  return json_build_object('ok', true, 'items', coalesce(
    (select json_agg(json_build_object('id',id,'to',to_address,'subject',subject,
                                       'body',body,'source',source,'tenant_id',tenant_id))
       from outbox where status = 'claimed' and claimed_at > now() - interval '1 minute'),
    '[]'::json));
end; $$;

create or replace function finish_outbox(p_id uuid, p_ok boolean, p_error text default null)
returns void language sql security definer set search_path = public as $$
  update outbox set
    status = case when p_ok then 'sent' else
                  case when attempts >= 3 then 'failed' else 'pending' end end,
    sent_at = case when p_ok then now() else null end,
    claimed_at = null,
    error = p_error
  where id = p_id;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · ANALYTICS — from data that already exists
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function analytics(p_slug text, p_days int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_tenant uuid; v_since timestamptz;
begin
  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;
  v_since := now() - make_interval(days => p_days);

  return json_build_object(
    'ok', true,
    'days', p_days,
    'summary', (select json_build_object(
        'conversations', count(distinct c.id),
        'messages', (select count(*) from messages m where m.tenant_id = v_tenant
                       and m.created_at > v_since),
        'bookings', (select count(*) from bookings b where b.tenant_id = v_tenant
                       and b.created_at > v_since),
        'escalations', (select count(*) from escalations e where e.tenant_id = v_tenant
                          and e.created_at > v_since),
        'cost', (select coalesce(sum(ai_cost_usd),0) from conversations
                   where tenant_id = v_tenant and created_at > v_since))
      from conversations c where c.tenant_id = v_tenant and c.created_at > v_since),
    -- of the conversations we had, how many ended in a booking
    'conversion', (select case when count(*) = 0 then 0
             else round(100.0 * count(*) filter (
                    where exists (select 1 from bookings b where b.conversation_id = c.id)) / count(*), 1)
             end
      from conversations c where c.tenant_id = v_tenant and c.created_at > v_since),
    'by_day', (select coalesce(json_agg(x order by x.day),'[]'::json) from (
        select to_char(d.day,'DD Mon') as day,
               (select count(*) from conversations c
                 where c.tenant_id = v_tenant and c.created_at::date = d.day) as conversations,
               (select count(*) from bookings b
                 where b.tenant_id = v_tenant and b.created_at::date = d.day) as bookings
        from generate_series(v_since::date, current_date, interval '1 day') d(day)) x),
    -- busiest hours, so an owner can see when to staff up
    'by_hour', (select coalesce(json_agg(x order by x.hour),'[]'::json) from (
        select extract(hour from m.created_at at time zone
                 coalesce((select timezone from tenants where id = v_tenant),'Asia/Kuala_Lumpur'))::int as hour,
               count(*) as messages
        from messages m
        where m.tenant_id = v_tenant and m.created_at > v_since and m.sender_type = 'customer'
        group by 1) x),
    'top_services', (select coalesce(json_agg(x order by x.n desc),'[]'::json) from (
        select i.name, count(*) as n
        from bookings b join items i on i.id = b.item_id
        where b.tenant_id = v_tenant and b.created_at > v_since
        group by i.name limit 6) x),
    'escalation_reasons', (select coalesce(json_agg(x order by x.n desc),'[]'::json) from (
        select reason, count(*) as n from escalations
        where tenant_id = v_tenant and created_at > v_since
        group by reason limit 6) x)
  );
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · SIGNUP LIMITS
-- /start was open to anyone, unlimited. This caps it per IP per day.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists signup_attempts (
  id         uuid primary key default gen_random_uuid(),
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

create index if not exists signup_ip_idx on signup_attempts(ip_hash, created_at desc);

create or replace function check_signup_limit(p_ip_hash text, p_max int default 3)
returns json language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  delete from signup_attempts where created_at < now() - interval '7 days';

  select count(*) into v_count from signup_attempts
   where ip_hash = p_ip_hash and created_at > now() - interval '24 hours';

  if v_count >= p_max then
    return json_build_object('ok', false, 'reason', 'too_many', 'tried', v_count);
  end if;

  insert into signup_attempts (ip_hash) values (p_ip_hash);
  return json_build_object('ok', true);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · Wire new actions into the guard
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function guarded_action(
  p_slug text, p_role text, p_action text, p_payload json
) returns json language plpgsql security definer set search_path = public as $$
declare v_need text; v_result json;
begin
  v_need := case p_action
    when 'price' then 'edit_prices' when 'save_item' then 'edit_prices'
    when 'remove_item' then 'edit_prices'
    when 'resolve_escalation' then 'handle_chats'
    when 'booking_status' then 'manage_bookings'
    when 'save_post' then 'marketing' when 'set_post_status' then 'marketing'
    when 'set_automation' then 'marketing' when 'save_broadcast' then 'marketing'
    when 'invoice' then 'finance' when 'invoice_status' then 'finance'
    when 'add_staff' then 'manage_team' when 'set_staff' then 'manage_team'
    when 'add_agent' then 'settings' when 'branding' then 'settings'
    when 'hours' then 'settings' when 'save_knowledge' then 'settings'
    when 'remove_knowledge' then 'settings' when 'add_branch' then 'settings'
    when 'claim_domain' then 'settings' when 'remove_domain' then 'settings'
    else 'view' end;

  if not guard(p_role, v_need) then
    return json_build_object('ok',false,'reason','not_allowed',
                             'needs',v_need,'your_role',p_role);
  end if;

  v_result := case p_action
    when 'price' then update_item_price((p_payload->>'id')::uuid,(p_payload->>'price')::numeric)
    when 'save_item' then save_item(p_slug, p_role, p_payload)
    when 'remove_item' then remove_item(p_slug, p_role, (p_payload->>'id')::uuid)
    when 'resolve_escalation' then resolve_escalation((p_payload->>'id')::uuid)
    when 'booking_status' then set_booking_status((p_payload->>'id')::uuid, p_payload->>'status')
    when 'save_post' then save_post(p_slug, p_payload)
    when 'set_post_status' then set_post_status((p_payload->>'id')::uuid, p_payload->>'status')
    when 'set_automation' then set_automation(p_slug, p_role, p_payload)
    when 'save_broadcast' then save_broadcast(p_slug, p_role, p_payload)
    when 'invoice' then invoice_for_booking((p_payload->>'id')::uuid)
    when 'invoice_status' then set_invoice_status((p_payload->>'id')::uuid, p_payload->>'status', null)
    when 'add_staff' then add_staff(p_slug, p_payload)
    when 'set_staff' then set_staff((p_payload->>'id')::uuid,
                                    coalesce(p_payload->>'role',''), coalesce(p_payload->>'status',''))
    when 'add_agent' then add_agent(p_slug, p_payload)
    when 'branding' then update_branding(p_slug, p_role, p_payload)
    when 'hours' then update_hours(p_slug, p_role, (p_payload->>'hours')::jsonb)
    when 'save_knowledge' then save_knowledge(p_slug, p_role, p_payload)
    when 'remove_knowledge' then remove_knowledge(p_slug, p_role, (p_payload->>'id')::uuid)
    when 'claim_domain' then claim_domain(p_slug, p_role, p_payload->>'hostname')
    when 'remove_domain' then remove_domain(p_slug, p_role, (p_payload->>'id')::uuid)
    else json_build_object('ok',false,'reason','unknown_action')
  end;

  perform audit(p_slug, coalesce(p_payload->>'actor', p_role), p_role, p_action,
                nullif(p_payload->>'id',''), p_payload);

  return v_result;
end; $$;

-- platform_data carries domains and the outbox count
create or replace function platform_extras(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'domains', (select coalesce(json_agg(json_build_object(
        'id',d.id,'hostname',d.hostname,'status',d.status,'token',d.verify_token)),'[]'::json)
      from domains d join tenants t on t.id = d.tenant_id
      where t.slug = p_slug and d.status <> 'removed'),
    'outbox', (select json_build_object(
        'pending', count(*) filter (where o.status in ('pending','claimed')),
        'sent', count(*) filter (where o.status = 'sent'),
        'failed', count(*) filter (where o.status = 'failed'))
      from outbox o join tenants t on t.id = o.tenant_id where t.slug = p_slug)
  );
$$;

revoke execute on function
  claim_domain(text,text,text), remove_domain(text,text,uuid), tenant_for_host(text),
  queue_automations(), claim_outbox(int), finish_outbox(uuid,boolean,text),
  analytics(text,int), check_signup_limit(text,int), platform_extras(text)
  from public, anon, authenticated;

grant execute on function
  claim_domain(text,text,text), remove_domain(text,text,uuid), tenant_for_host(text),
  queue_automations(), claim_outbox(int), finish_outbox(uuid,boolean,text),
  analytics(text,int), check_signup_limit(text,int), platform_extras(text)
  to service_role;

-- ============================================================================
-- CHECK
--   select claim_domain('damai-clinic','owner','chat.damaiclinic.my');
--     → returns the CNAME to give them
--   select tenant_for_host('chat.damaiclinic.my');   → resolves, marks live
--   select queue_automations();                      → fills the outbox
--   select claim_outbox(5);                          → what the worker sends
--   select analytics('damai-clinic', 30);
-- ============================================================================
