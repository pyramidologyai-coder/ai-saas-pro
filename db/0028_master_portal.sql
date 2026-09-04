-- ============================================================================
-- 0028_master_portal.sql — the view across the whole platform.
-- Run AFTER 0027. Safe to re-run.
--
-- Everything so far answers "how is this business doing?". Nothing answers
-- "how is Automology doing?" — revenue, cost, growth, which customers are
-- healthy and which are about to leave. That's this.
--
-- ⚠ WHO CAN SEE THIS
-- Only the master password. A business key must never reach these functions,
-- so every one of them is service_role only and the API checks the master
-- cookie before calling. A tenant seeing platform revenue would be a serious
-- leak, not a cosmetic one.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · The number that matters most: is this customer still alive?
--
-- A business that stopped getting conversations has effectively churned, even
-- while the subscription is still billing. Knowing that two weeks early is the
-- difference between saving them and reading about it in Stripe.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function tenant_health(p_tenant uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_last timestamptz; v_7 int; v_prev7 int; v_bookings int;
  v_wallet numeric; v_state text; v_trend text; v_days int;
begin
  select max(created_at) into v_last from conversations where tenant_id = p_tenant;

  select count(*) into v_7 from conversations
   where tenant_id = p_tenant and created_at > now() - interval '7 days';
  select count(*) into v_prev7 from conversations
   where tenant_id = p_tenant
     and created_at between now() - interval '14 days' and now() - interval '7 days';
  select count(*) into v_bookings from bookings
   where tenant_id = p_tenant and created_at > now() - interval '30 days';
  select wallet_balance_usd into v_wallet from tenants where id = p_tenant;

  v_days := case when v_last is null then 999
                 else extract(day from now() - v_last)::int end;

  v_state := case
    when v_last is null                       then 'never_used'
    when v_days > 21                          then 'dormant'
    when v_days > 7                           then 'quiet'
    when v_7 = 0                              then 'quiet'
    else 'active' end;

  v_trend := case
    when v_prev7 = 0 and v_7 > 0 then 'starting'
    when v_prev7 = 0             then 'flat'
    when v_7 > v_prev7 * 1.2     then 'growing'
    when v_7 < v_prev7 * 0.6     then 'falling'
    else 'steady' end;

  return json_build_object(
    'state', v_state,
    'trend', v_trend,
    'days_since_last', case when v_last is null then null else v_days end,
    'conversations_7d', v_7,
    'conversations_prev_7d', v_prev7,
    'bookings_30d', v_bookings,
    'wallet', v_wallet,
    -- what to actually do about it
    'action', case
      when v_last is null then 'Never used it. Onboarding never landed — call them.'
      when v_days > 21    then 'Silent three weeks. Assume churned unless you reach out.'
      when v_days > 7     then 'Gone quiet. Worth a check-in before it becomes dormant.'
      when v_wallet < 1   then 'Out of credit. The agent may have stopped answering.'
      when v_trend = 'falling' then 'Volume dropping. Ask what changed.'
      else 'Healthy.' end);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · Platform overview
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function master_overview()
returns json language plpgsql stable security definer set search_path = public as $$
declare v json;
begin
  select json_build_object(
    'ok', true,
    'generated_at', now(),

    'businesses', (select json_build_object(
        'total',   count(*),
        'trial',   count(*) filter (where t.plan = 'trial'),
        'paying',  count(*) filter (where t.plan <> 'trial'),
        'new_7d',  count(*) filter (where t.created_at > now() - interval '7 days'),
        'new_30d', count(*) filter (where t.created_at > now() - interval '30 days'))
      from tenants t),

    -- monthly recurring revenue, from live subscriptions only
    'revenue', (select json_build_object(
        'mrr',        coalesce(sum(s.amount) filter (where s.status = 'active'), 0),
        'currency',   'MYR',
        'active',     count(*) filter (where s.status = 'active'),
        'trialing',   count(*) filter (where s.status = 'trialing'),
        'past_due',   count(*) filter (where s.status = 'past_due'),
        'cancelled',  count(*) filter (where s.status = 'cancelled'))
      from subscriptions s),

    -- what the platform costs to run, from the usage we actually logged
    'cost', (select json_build_object(
        'ai_30d',    coalesce(sum(c.ai_cost_usd) filter (
                       where c.created_at > now() - interval '30 days'), 0),
        'ai_total',  coalesce(sum(c.ai_cost_usd), 0),
        'messages_30d', (select count(*) from messages
                          where created_at > now() - interval '30 days'))
      from conversations c),

    'usage', (select json_build_object(
        'conversations_total', (select count(*) from conversations),
        'conversations_7d',    (select count(*) from conversations
                                 where created_at > now() - interval '7 days'),
        'bookings_total',      (select count(*) from bookings),
        'bookings_7d',         (select count(*) from bookings
                                 where created_at > now() - interval '7 days'),
        'agents',              (select count(*) from ai_employees where status = 'active'),
        'customers',           (select count(*) from customers))),

    -- anything that needs a human at Automology, not at a tenant
    'attention', (select json_build_object(
        'low_wallet',     (select count(*) from tenants where wallet_balance_usd < 1),
        'past_due',       (select count(*) from subscriptions where status = 'past_due'),
        'open_escalations',(select count(*) from escalations where status = 'open'),
        'failed_emails',  (select count(*) from email_log
                            where status = 'failed' and created_at > now() - interval '7 days'),
        'stuck_outbox',   (select count(*) from outbox
                            where status in ('pending','claimed')
                              and send_after < now() - interval '2 hours'),
        'trials_ending',  (select count(*) from subscriptions
                            where status = 'trialing'
                              and trial_ends_at between now() and now() + interval '3 days'))),

    -- growth, week by week
    'signups', (select coalesce(json_agg(x order by x.week), '[]'::json) from (
        select to_char(d.week, 'DD Mon') as week,
               (select count(*) from tenants t
                 where t.created_at >= d.week and t.created_at < d.week + interval '7 days') as n
        from generate_series(date_trunc('week', now()) - interval '11 weeks',
                             date_trunc('week', now()), interval '1 week') d(week)) x),

    'by_sector', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (
        select vertical as sector, count(*) as n from tenants
        group by vertical) x)
  ) into v;
  return v;
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · Every business, with health
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function master_businesses()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(b order by b.created_at desc), '[]'::json)
  from (
    select
      t.name, t.slug, t.vertical, t.plan, t.status, t.created_at,
      coalesce(t.brand_color, '#1D6A8C') as color,
      t.wallet_balance_usd as wallet,
      t.email, t.custom_domain as domain,
      (select o.name from organisations o where o.id = t.organisation_id) as organisation,
      (select persona_name from ai_employees e
        where e.tenant_id = t.id and e.status = 'active'
        order by e.is_primary desc limit 1) as agent,
      (select count(*) from ai_employees e
        where e.tenant_id = t.id and e.status = 'active') as agents,
      (select count(*) from conversations c where c.tenant_id = t.id) as conversations,
      (select count(*) from bookings bk where bk.tenant_id = t.id) as bookings,
      (select coalesce(sum(c.ai_cost_usd), 0) from conversations c
        where c.tenant_id = t.id) as ai_cost,
      (select coalesce(sum(i.amount) filter (where i.status = 'paid'), 0)
         from invoices i where i.tenant_id = t.id) as their_revenue,
      (select s.status from subscriptions s where s.tenant_id = t.id) as sub_status,
      (select s.amount from subscriptions s where s.tenant_id = t.id) as sub_amount,
      (select s.trial_ends_at from subscriptions s where s.tenant_id = t.id) as trial_ends,
      tenant_health(t.id) as health
    from tenants t
  ) b;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · Shareholder view
--
-- Deliberately narrow. Growth, revenue, margin, retention — and no customer
-- names, no conversations, nothing personal. A shareholder needs the shape of
-- the business, not the contents of anyone's inbox.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function shareholder_report()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_mrr numeric; v_cost numeric; v_total int; v_paying int;
  v_active int; v_new30 int; v_churn30 int;
begin
  select coalesce(sum(amount) filter (where status = 'active'), 0) into v_mrr
    from subscriptions;
  select coalesce(sum(ai_cost_usd) filter (
           where created_at > now() - interval '30 days'), 0) into v_cost
    from conversations;
  select count(*) into v_total from tenants;
  select count(*) into v_paying from subscriptions where status = 'active';
  select count(*) into v_new30 from tenants where created_at > now() - interval '30 days';
  select count(*) into v_churn30 from subscriptions
   where status = 'cancelled' and cancelled_at > now() - interval '30 days';

  select count(*) into v_active from tenants t
   where exists (select 1 from conversations c
                  where c.tenant_id = t.id and c.created_at > now() - interval '30 days');

  return json_build_object(
    'ok', true,
    'as_of', now(),
    'revenue', json_build_object(
      'mrr', v_mrr, 'arr', v_mrr * 12, 'currency', 'MYR',
      'paying_customers', v_paying,
      'average_per_customer', case when v_paying = 0 then 0
                                   else round(v_mrr / v_paying, 2) end),
    'cost', json_build_object(
      'ai_30d_usd', round(v_cost, 2),
      -- the honest headline: what we keep after the model is paid for
      'gross_margin_pct', case when v_mrr = 0 then null
        else round(100 * (1 - (v_cost * 4.7) / nullif(v_mrr, 0)), 1) end,
      'note', 'AI cost only. Hosting, database and email are not yet metered here.'),
    'customers', json_build_object(
      'total', v_total, 'paying', v_paying,
      'active_30d', v_active,
      'new_30d', v_new30, 'churned_30d', v_churn30,
      'activation_pct', case when v_total = 0 then 0
                             else round(100.0 * v_active / v_total, 1) end),
    'growth', (select coalesce(json_agg(x order by x.month), '[]'::json) from (
        select to_char(d.month, 'Mon YYYY') as month,
               (select count(*) from tenants t
                 where t.created_at >= d.month
                   and t.created_at < d.month + interval '1 month') as signups
        from generate_series(date_trunc('month', now()) - interval '5 months',
                             date_trunc('month', now()), interval '1 month') d(month)) x),
    'caveats', json_build_array(
      'Revenue counts only subscriptions marked active.',
      'Margin covers the AI model only; infrastructure is not yet metered.',
      'A customer is "active" if they had any conversation in the last 30 days.')
  );
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · Platform health — what's broken right now
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function master_health()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'ok', true,
    'email', (select json_build_object(
        'sent_7d',   count(*) filter (where status = 'sent'),
        'failed_7d', count(*) filter (where status = 'failed'),
        'last_error',(select error from email_log
                       where status = 'failed' order by created_at desc limit 1))
      from email_log where created_at > now() - interval '7 days'),
    'outbox', (select json_build_object(
        'pending', count(*) filter (where status = 'pending'),
        'stuck',   count(*) filter (where status in ('pending','claimed')
                                      and send_after < now() - interval '2 hours'),
        'failed',  count(*) filter (where status = 'failed'))
      from outbox),
    'agents_without_prompt', (select count(*) from ai_employees
      where status = 'active' and (compiled_prompt is null or compiled_prompt = '')),
    'tenants_without_agent', (select count(*) from tenants t
      where not exists (select 1 from ai_employees e
                         where e.tenant_id = t.id and e.status = 'active')),
    'tenants_without_services', (select count(*) from tenants t
      where not exists (select 1 from items i
                         where i.tenant_id = t.id and i.is_active)),
    'domains_pending', (select count(*) from domains where status = 'pending'),
    'escalations_open_over_24h', (select count(*) from escalations
      where status = 'open' and created_at < now() - interval '24 hours')
  );
$$;

revoke execute on function
  master_overview(), master_businesses(), shareholder_report(),
  master_health(), tenant_health(uuid)
  from public, anon, authenticated;

grant execute on function
  master_overview(), master_businesses(), shareholder_report(),
  master_health(), tenant_health(uuid)
  to service_role;

-- ============================================================================
-- CHECK
--   select master_overview();
--   select master_businesses();
--   select shareholder_report();
--   select master_health();
--   select tenant_health((select id from tenants where slug='damai-clinic'));
-- ============================================================================
