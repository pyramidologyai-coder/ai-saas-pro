-- ============================================================================
-- 0035_portal_waitlist_reviews.sql — the customer's side of the relationship.
-- Run AFTER 0034. Safe to re-run.
--
--   PORTAL    a customer sees everything they have with this business
--   WAITLIST  a full slot stops being a lost customer
--   REVIEWS   asked at the right moment, and acted on when they're bad
--
-- ⚠ ACCESS WITHOUT AN ACCOUNT
-- Same principle as the booking link: asking a patient to make an account is
-- how you lose them. The portal is opened by a short-lived code sent to the
-- phone or email already on their record. Nothing is ever listed to someone
-- who merely knows a name.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · PORTAL ACCESS
--
-- A code, not a password. Six digits, expires in fifteen minutes, three
-- attempts, and rate-limited per contact so it can't be used to work out
-- whether someone is a patient here.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists portal_codes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  contact     text not null,
  code        text not null,
  attempts    int not null default 0,
  used_at     timestamptz,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists portal_codes_lookup
  on portal_codes(tenant_id, contact, created_at desc);
alter table portal_codes enable row level security;

create table if not exists portal_sessions (
  token       text primary key,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

alter table portal_sessions enable row level security;

-- Reviews are declared here because the portal reads them when listing past
-- visits. A table has to exist before a function that queries it is created.
create table if not exists reviews (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  booking_id  uuid references bookings(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  resource_id uuid references resources(id) on delete set null,
  score       int not null,
  comment     text,
  token       text unique,
  responded_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint review_score_chk check (score between 1 and 5),
  unique (booking_id)
);

create index if not exists reviews_tenant_idx on reviews(tenant_id, created_at desc);
alter table reviews enable row level security;
alter table reviews force row level security;
drop policy if exists tenant_isolation on reviews;
create policy tenant_isolation on reviews for all
  using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());


/**
 * Ask for a code.
 *
 * Always returns the same shape whether or not the contact is known. If it
 * said "no such customer", anyone could use it to find out who is a patient
 * at a clinic — which is exactly the kind of thing that must not be knowable.
 */
create or replace function portal_request(p_slug text, p_contact text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid; v_customer uuid; v_code text; v_contact text;
  v_recent int; v_digits text; v_name text; v_business text;
begin
  select id, name into v_tenant, v_business from tenants where slug = p_slug;
  if v_tenant is null then
    return json_build_object('ok', true, 'sent', true);   -- reveal nothing
  end if;

  v_contact := lower(trim(coalesce(p_contact, '')));
  if length(v_contact) < 5 then
    return json_build_object('ok', false, 'reason', 'bad_contact');
  end if;

  -- don't let this be used as a doorbell
  select count(*) into v_recent from portal_codes
   where tenant_id = v_tenant and contact = v_contact
     and created_at > now() - interval '15 minutes';
  if v_recent >= 3 then
    return json_build_object('ok', false, 'reason', 'too_many',
      'hint', 'Wait a few minutes before asking for another code.');
  end if;

  v_digits := nullif(regexp_replace(v_contact, '[^0-9]', '', 'g'), '');

  select c.id, c.name into v_customer, v_name
  from customers c
  where c.tenant_id = v_tenant
    and (lower(coalesce(c.email, '')) = v_contact
      or (v_digits is not null and length(v_digits) >= 7
          and right(regexp_replace(coalesce(c.phone,''), '[^0-9]', '', 'g'), 8)
              = right(v_digits, 8)))
  order by c.last_seen_at desc limit 1;

  if v_customer is null then
    return json_build_object('ok', true, 'sent', true);   -- same answer either way
  end if;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into portal_codes (tenant_id, customer_id, contact, code, expires_at)
  values (v_tenant, v_customer, v_contact, v_code, now() + interval '15 minutes');

  -- send it, if we have somewhere to send it
  if v_contact like '%@%' then
    insert into outbox (tenant_id, customer_id, source, to_address, subject, body, send_after)
    values (v_tenant, v_customer, 'portal_code_' || v_code, v_contact,
            'Your code for ' || v_business,
            'Your code is ' || v_code || E'\n\n' ||
            'It works for the next 15 minutes. If you did not ask for it, ignore this.',
            now());
  end if;

  return json_build_object('ok', true, 'sent', true);
end; $$;

create or replace function portal_verify(p_slug text, p_contact text, p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_row record; v_token text;
begin
  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok', false, 'reason', 'bad_code'); end if;

  select * into v_row from portal_codes
   where tenant_id = v_tenant
     and contact = lower(trim(coalesce(p_contact, '')))
     and used_at is null
   order by created_at desc limit 1;

  if not found then return json_build_object('ok', false, 'reason', 'bad_code'); end if;

  if v_row.expires_at < now() then
    return json_build_object('ok', false, 'reason', 'expired',
      'hint', 'That code has expired. Ask for a new one.');
  end if;

  if v_row.attempts >= 3 then
    return json_build_object('ok', false, 'reason', 'too_many_attempts',
      'hint', 'Too many tries. Ask for a new code.');
  end if;

  if v_row.code <> trim(coalesce(p_code, '')) then
    update portal_codes set attempts = attempts + 1 where id = v_row.id;
    return json_build_object('ok', false, 'reason', 'bad_code');
  end if;

  update portal_codes set used_at = now() where id = v_row.id;

  v_token := lower(random_code(12) || random_code(12) || random_code(12));
  insert into portal_sessions (token, tenant_id, customer_id, expires_at)
  values (v_token, v_tenant, v_row.customer_id, now() + interval '30 days');

  return json_build_object('ok', true, 'token', v_token);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Everything a customer may see about themselves. Only themselves.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function portal_data(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_tenant uuid; v_customer uuid; v_tz text; v_result json;
begin
  select s.tenant_id, s.customer_id, coalesce(t.timezone, 'Asia/Kuala_Lumpur')
    into v_tenant, v_customer, v_tz
  from portal_sessions s join tenants t on t.id = s.tenant_id
  where s.token = lower(trim(coalesce(p_token, ''))) and s.expires_at > now();

  if v_tenant is null then
    return json_build_object('ok', false, 'reason', 'signed_out');
  end if;

  select json_build_object(
    'ok', true,
    'business', (select json_build_object(
        'name', t.name, 'slug', t.slug, 'color', coalesce(t.brand_color, '#1D6A8C'),
        'phone', t.phone, 'address', t.address, 'logo_url', t.logo_url,
        'hours', t.opening_hours)
      from tenants t where t.id = v_tenant),
    'you', (select json_build_object(
        'name', c.name, 'phone', c.phone, 'email', c.email,
        'visits', c.visit_count, 'since', c.first_seen_at)
      from customers c where c.id = v_customer),
    'upcoming', (select coalesce(json_agg(json_build_object(
        'id', b.id, 'manage_token', b.manage_token, 'status', b.status,
        'when', to_char(b.scheduled_at at time zone v_tz, 'Day DD Mon YYYY, HH24:MI'),
        'when_iso', b.scheduled_at,
        'service', i.name, 'price', i.price_local, 'currency', i.currency_code,
        'with', r.name) order by b.scheduled_at), '[]'::json)
      from bookings b
      left join items i on i.id = b.item_id
      left join resources r on r.id = b.resource_id
      where b.customer_id = v_customer and b.status in ('pending','confirmed')
        and b.scheduled_at > now()),
    'past', (select coalesce(json_agg(json_build_object(
        'when', to_char(b.scheduled_at at time zone v_tz, 'DD Mon YYYY'),
        'service', i.name, 'status', b.status,
        'reviewed', exists (select 1 from reviews rv where rv.booking_id = b.id))
        order by b.scheduled_at desc), '[]'::json)
      from bookings b left join items i on i.id = b.item_id
      where b.customer_id = v_customer
        and (b.scheduled_at <= now() or b.status in ('completed','cancelled','no_show'))
      limit 20),
    'invoices', (select coalesce(json_agg(json_build_object(
        'number', inv.number, 'amount', inv.amount, 'currency', inv.currency,
        'status', inv.status, 'issued_on', inv.issued_on)
        order by inv.issued_on desc), '[]'::json)
      from invoices inv where inv.customer_id = v_customer limit 20)
  ) into v_result;

  return v_result;
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · WAITLIST
--
-- "We're fully booked" is where a customer leaves. This keeps them, and turns
-- a cancellation into a filled slot instead of an empty chair.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists waitlist (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  item_id     uuid references items(id) on delete set null,
  wanted_from timestamptz,
  wanted_to   timestamptz,
  note        text,
  contact     text,
  status      text not null default 'waiting',
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint waitlist_status_chk check (status in ('waiting','offered','booked','expired'))
);

create index if not exists waitlist_open_idx
  on waitlist(tenant_id, wanted_from) where status = 'waiting';
alter table waitlist enable row level security;
alter table waitlist force row level security;
drop policy if exists tenant_isolation on waitlist;
create policy tenant_isolation on waitlist for all
  using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());

create or replace function join_waitlist(
  p_slug text, p_conversation_id uuid, p_service text,
  p_from text default null, p_note text default null
) returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_customer uuid; v_item uuid; v_tz text; v_from timestamptz;
begin
  select id, coalesce(timezone,'Asia/Kuala_Lumpur') into v_tenant, v_tz
  from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  select customer_id into v_customer from conversations where id = p_conversation_id;
  if v_customer is null then return json_build_object('ok',false,'reason','unknown_conversation'); end if;

  select id into v_item from items
   where tenant_id = v_tenant and is_active
     and lower(name) like '%' || lower(trim(coalesce(p_service,''))) || '%' limit 1;

  begin v_from := (p_from::timestamp) at time zone v_tz;
  exception when others then v_from := now(); end;

  insert into waitlist (tenant_id, customer_id, item_id, wanted_from, note,
                        contact)
  select v_tenant, v_customer, v_item, v_from, nullif(trim(coalesce(p_note,'')),''),
         coalesce(c.phone, c.email)
  from customers c where c.id = v_customer;

  return json_build_object('ok', true);
end; $$;

/**
 * A cancellation frees a slot. Find whoever was waiting for roughly that time
 * and tell them — first come, first served, oldest request first.
 */
create or replace function offer_freed_slot(p_booking_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v record; w record; v_n int := 0; v_url text;
begin
  select b.tenant_id, b.item_id, b.scheduled_at, t.name as business, t.slug,
         coalesce(t.timezone,'Asia/Kuala_Lumpur') as tz, i.name as service
    into v
  from bookings b join tenants t on t.id = b.tenant_id
  left join items i on i.id = b.item_id
  where b.id = p_booking_id;

  if not found then return json_build_object('ok', false); end if;

  for w in
    select wl.id, wl.customer_id, c.email, c.name
    from waitlist wl join customers c on c.id = wl.customer_id
    where wl.tenant_id = v.tenant_id and wl.status = 'waiting'
      and (wl.item_id is null or wl.item_id = v.item_id)
      and (wl.wanted_from is null
           or v.scheduled_at between wl.wanted_from - interval '3 days'
                                 and coalesce(wl.wanted_to, wl.wanted_from + interval '7 days'))
      and c.email is not null and coalesce(c.opted_out, false) = false
    order by wl.created_at
    limit 3        -- offer to a few, not to everyone: the slot is one slot
  loop
    insert into outbox (tenant_id, customer_id, source, to_address, subject, body, send_after)
    values (v.tenant_id, w.customer_id, 'waitlist_' || p_booking_id || '_' || w.id,
            w.email,
            'A slot has opened at ' || v.business,
            coalesce(w.name, 'Hello') || ',' || E'\n\n' ||
            'A ' || coalesce(v.service, 'appointment') || ' slot has just opened on ' ||
            to_char(v.scheduled_at at time zone v.tz, 'Day DD Mon at HH24:MI') || '.' || E'\n\n' ||
            'It is first come, first served — reply or call us if you would like it.',
            now())
    on conflict do nothing;

    update waitlist set status = 'offered', notified_at = now() where id = w.id;
    v_n := v_n + 1;
  end loop;

  return json_build_object('ok', true, 'offered_to', v_n);
end; $$;

-- fire it whenever a booking is cancelled
create or replace function on_booking_cancelled()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and coalesce(old.status,'') <> 'cancelled' then
    perform offer_freed_slot(new.id);
  end if;
  return new;
exception when others then return new;   -- never block a cancellation
end; $$;

drop trigger if exists booking_cancelled_trg on bookings;
create trigger booking_cancelled_trg
  after update of status on bookings
  for each row execute function on_booking_cancelled();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · REVIEWS
--
-- Asked after a visit, through a one-use link. A poor score never goes
-- anywhere public — it opens an escalation, because the point is to fix it.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function review_by_token(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v record;
begin
  select b.id as booking_id, b.manage_token, b.scheduled_at,
         t.name as business, coalesce(t.brand_color,'#1D6A8C') as color, t.logo_url,
         coalesce(t.timezone,'Asia/Kuala_Lumpur') as tz,
         i.name as service, r.name as with_name, c.name as customer,
         (select score from reviews rv where rv.booking_id = b.id) as existing
    into v
  from bookings b
  join tenants t on t.id = b.tenant_id
  left join items i on i.id = b.item_id
  left join resources r on r.id = b.resource_id
  left join customers c on c.id = b.customer_id
  where b.manage_token = lower(trim(coalesce(p_token, '')));

  if not found then return json_build_object('ok', false, 'reason', 'not_found'); end if;

  return json_build_object('ok', true,
    'already', v.existing,
    'business', json_build_object('name', v.business, 'color', v.color,
                                  'logo_url', v.logo_url),
    'visit', json_build_object(
      'service', v.service, 'with', v.with_name, 'customer', v.customer,
      'when', to_char(v.scheduled_at at time zone v.tz, 'DD Mon YYYY')));
end; $$;

create or replace function leave_review(p_token text, p_score int, p_comment text default null)
returns json language plpgsql security definer set search_path = public as $$
declare v record; v_id uuid;
begin
  if p_score is null or p_score < 1 or p_score > 5 then
    return json_build_object('ok', false, 'reason', 'bad_score');
  end if;

  select b.id, b.tenant_id, b.customer_id, b.resource_id, b.conversation_id,
         t.name as business, i.name as service, coalesce(c.name,'A customer') as customer
    into v
  from bookings b
  join tenants t on t.id = b.tenant_id
  left join items i on i.id = b.item_id
  left join customers c on c.id = b.customer_id
  where b.manage_token = lower(trim(coalesce(p_token, '')));

  if not found then return json_build_object('ok', false, 'reason', 'not_found'); end if;

  insert into reviews (tenant_id, booking_id, customer_id, resource_id, score, comment)
  values (v.tenant_id, v.id, v.customer_id, v.resource_id, p_score,
          nullif(trim(coalesce(p_comment, '')), ''))
  on conflict (booking_id) do update
    set score = excluded.score, comment = coalesce(excluded.comment, reviews.comment),
        created_at = now()
  returning id into v_id;

  -- An unhappy customer is a thing to fix, not a number to file. Anything at
  -- 3 or below goes straight to a human.
  if p_score <= 3 then
    insert into escalations (tenant_id, conversation_id, reason, trigger_source, status)
    values (v.tenant_id, v.conversation_id,
            'poor_review_' || p_score, 'review', 'open');

    insert into outbox (tenant_id, source, to_address, subject, body, send_after)
    select v.tenant_id, 'review_alert_' || v_id, e,
      'A ' || p_score || '-star review needs you',
      v.customer || ' rated their ' || coalesce(v.service, 'visit') ||
        ' ' || p_score || ' out of 5.' || E'\n\n' ||
      case when nullif(trim(coalesce(p_comment,'')),'') is null
           then 'They left no comment.'
           else 'They said: ' || trim(p_comment) end || E'\n\n' ||
      'Worth a call today.',
      now()
    from (
      select s.email as e from staff s
       where s.tenant_id = v.tenant_id and s.role in ('owner','manager')
         and s.status = 'active' and s.email is not null
      union
      select t.email from tenants t
       where t.id = v.tenant_id and t.email is not null and t.email not like '%.local'
    ) x where e is not null
    on conflict do nothing;
  end if;

  return json_build_object('ok', true, 'score', p_score,
    'follow_up', p_score <= 3);
end; $$;

create or replace function review_summary(p_slug text, p_days int default 90)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_tenant uuid;
begin
  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok', false); end if;

  return json_build_object(
    'ok', true,
    'summary', (select json_build_object(
        'count', count(*),
        'average', round(coalesce(avg(score), 0)::numeric, 2),
        'promoters', count(*) filter (where score >= 4),
        'unhappy', count(*) filter (where score <= 3))
      from reviews where tenant_id = v_tenant
        and created_at > now() - make_interval(days => p_days)),
    'recent', (select coalesce(json_agg(json_build_object(
        'score', rv.score, 'comment', rv.comment, 'when', rv.created_at,
        'customer', coalesce(c.name, 'A customer'),
        'service', i.name, 'with', r.name) order by rv.created_at desc), '[]'::json)
      from reviews rv
      left join customers c on c.id = rv.customer_id
      left join bookings b on b.id = rv.booking_id
      left join items i on i.id = b.item_id
      left join resources r on r.id = rv.resource_id
      where rv.tenant_id = v_tenant limit 20),
    'by_person', (select coalesce(json_agg(json_build_object(
        'name', x.name, 'average', x.avg_score, 'count', x.n)
        order by x.avg_score desc), '[]'::json)
      from (select r.name, round(avg(rv.score)::numeric, 2) as avg_score, count(*) as n
            from reviews rv join resources r on r.id = rv.resource_id
            where rv.tenant_id = v_tenant group by r.name) x));
end; $$;

-- the review request automation now links somewhere real
update automations
   set body = 'Thanks for coming in. If you have a moment, we would love to know '
              'how it went — it takes about ten seconds.'
 where kind = 'review_request' and body like 'Thanks for coming in%';

revoke execute on function
  portal_request(text,text), portal_verify(text,text,text), portal_data(text),
  join_waitlist(text,uuid,text,text,text), offer_freed_slot(uuid),
  review_by_token(text), leave_review(text,int,text), review_summary(text,int)
  from public, anon, authenticated;

grant execute on function
  portal_request(text,text), portal_verify(text,text,text), portal_data(text),
  join_waitlist(text,uuid,text,text,text), offer_freed_slot(uuid),
  review_by_token(text), leave_review(text,int,text), review_summary(text,int)
  to service_role;

-- the worker needs booking_id to attach a review link
create or replace function claim_outbox(p_limit int default 25)
returns json language plpgsql security definer set search_path = public as $$
begin
  update outbox set status = 'pending', claimed_at = null
   where status = 'claimed' and claimed_at < now() - interval '10 minutes';

  with picked as (
    select id from outbox
     where status = 'pending' and send_after <= now() and attempts < 3
     order by send_after limit p_limit for update skip locked
  )
  update outbox o set status = 'claimed', claimed_at = now(), attempts = o.attempts + 1
    from picked p where o.id = p.id;

  return json_build_object('ok', true, 'items', coalesce(
    (select json_agg(json_build_object('id',id,'to',to_address,'subject',subject,
                                       'body',body,'source',source,
                                       'tenant_id',tenant_id,'booking_id',booking_id))
       from outbox where status = 'claimed' and claimed_at > now() - interval '1 minute'),
    '[]'::json));
end; $$;

grant execute on function claim_outbox(int) to service_role;

-- the customer portal link belongs in the confirmation too
create or replace function portal_url(p_slug text, p_origin text)
returns text language sql immutable as $$
  select p_origin || '/my/' || p_slug;
$$;

grant execute on function portal_url(text, text) to service_role;

-- ============================================================================
-- CHECK
--   select portal_request('damai-clinic', 'ahmad@example.com');
--   select code from portal_codes order by created_at desc limit 1;
--   select portal_verify('damai-clinic', 'ahmad@example.com', '<that code>');
--   select portal_data('<the token it returned>');
--
--   -- a cancellation should offer the slot to anyone waiting:
--   select join_waitlist('damai-clinic', (select id from conversations limit 1),
--                        'General consultation');
--   update bookings set status = 'cancelled' where id = (select id from bookings limit 1);
--   select source, subject from outbox order by created_at desc limit 3;
--
--   select leave_review('<a booking manage_token>', 2, 'Waited 40 minutes');
--   → opens an escalation and emails the owner
--   select review_summary('damai-clinic');
-- ============================================================================
