-- ============================================================================
-- 0025_platform_data_fix.sql — one file, fixes the dashboard.
-- Run AFTER 0024. Safe to re-run. Nothing else needs re-running.
--
-- THE BUG (mine, and the third time in this shape):
--   json_agg(p order by p.created_at) over a subquery whose select list didn't
--   include created_at. Postgres can only sort by what the subquery exposes.
--   It broke platform_data(), so every dashboard said "No business found".
--
-- Fixed here for posts and broadcasts, and I've now checked every json_agg
-- sort in all 25 migrations against its subquery's actual columns.
-- ============================================================================

create or replace function platform_data(p_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_result json;
begin
  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  perform ensure_social_rows(v_tenant);
  perform ensure_subscription(v_tenant);
  perform ensure_automations(v_tenant);

  select json_build_object(
    'ok', true,
    'business', (select json_build_object(
        'name',t.name,'slug',t.slug,'color',coalesce(t.brand_color,'#1D6A8C'),
        'plan',t.plan,'wallet',t.wallet_balance_usd,'domain',t.custom_domain,
        'tagline',t.tagline,'address',t.address,'phone',t.phone,'map_url',t.map_url,
        'greeting',t.brand_greeting,'suggestions',t.brand_suggestions,
        'hours',t.opening_hours,'logo_url',t.logo_url,'access_code',t.access_code,
        'email',t.email,'branch_label',t.branch_label,
        'organisation',(select o.slug from organisations o where o.id = t.organisation_id))
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
        select id, body, platforms, status, scheduled_at, published_at, reach, clicks,
               created_at
        from posts where tenant_id = v_tenant order by created_at desc limit 30) p),
    'automations', (select coalesce(json_agg(a order by a.kind),'[]'::json) from (
        select id, kind, is_on, offset_hours, body, channel, sent_count
        from automations where tenant_id = v_tenant) a),
    'broadcasts', (select coalesce(json_agg(b order by b.created_at desc),'[]'::json) from (
        select id, body, audience, channel, status, scheduled_at, recipients, sent_count,
               created_at
        from broadcasts where tenant_id = v_tenant order by created_at desc limit 20) b),
    'audit', audit_trail(p_slug, 40),
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
                      and status='open'),
        'customers',(select count(*) from customers where tenant_id = v_tenant)))
  ) into v_result;

  return v_result;
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Prove it before you leave this file.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare r record; v json;
begin
  for r in select slug from tenants loop
    v := platform_data(r.slug);
    if not (v->>'ok')::boolean then
      raise exception 'platform_data failed for %: %', r.slug, v::text;
    end if;
  end loop;
  raise notice 'platform_data works for every business.';
end $$;

-- ============================================================================
-- CHECK
--   select platform_data('damai-clinic');   → a large JSON object, ok:true
--   then reload /dashboard/damai-clinic
-- ============================================================================
