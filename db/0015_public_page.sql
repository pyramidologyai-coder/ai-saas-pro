-- ============================================================================
-- 0015_public_page.sql — everything the patient-facing page needs.
-- Run AFTER 0014. Safe to re-run.
--
-- The chat widget only ever needed a colour and a greeting. A real page needs
-- structured opening hours (so it can say "open now, closes at 6"), an address,
-- and a line about what the business does. All per tenant, all editable
-- without touching code.
-- ============================================================================

alter table tenants
  add column if not exists opening_hours jsonb,
  add column if not exists address       text,
  add column if not exists tagline       text,
  add column if not exists map_url       text;

comment on column tenants.opening_hours is
  'Per weekday: {"mon":["08:30","18:00"], ..., "sun":null}. Null means closed.';

-- ── Clinic ──────────────────────────────────────────────────────────────────
update tenants set
  opening_hours = '{
    "mon":["08:30","18:00"], "tue":["08:30","18:00"], "wed":["08:30","18:00"],
    "thu":["08:30","18:00"], "fri":["08:30","18:00"],
    "sat":["09:00","13:00"], "sun":null
  }'::jsonb,
  address = 'Jalan SS15/4B, Subang Jaya, Selangor',
  tagline = 'A family clinic. Walk in, or book ahead.',
  map_url = 'https://maps.google.com/?q=Subang+Jaya+Selangor'
where slug = 'damai-clinic';

-- ── Salon ───────────────────────────────────────────────────────────────────
update tenants set
  opening_hours = '{
    "mon":null, "tue":["10:00","19:00"], "wed":["10:00","19:00"],
    "thu":["10:00","19:00"], "fri":["10:00","19:00"], "sat":["10:00","19:00"],
    "sun":["11:00","17:00"]
  }'::jsonb,
  address = 'Bangsar, Kuala Lumpur',
  tagline = 'Colour, cuts and care. Book in seconds.'
where slug = 'sunrise-hair';

-- ─────────────────────────────────────────────────────────────────────────────
-- get_widget_config(slug) — now returns the whole page, not just the widget.
-- Public on purpose: it is exactly what a visitor sees anyway. No prompt,
-- no costs, no other tenant's rows.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function get_widget_config(p_slug text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'business_name', t.name,
    'agent_name',    coalesce(e.persona_name, 'Assistant'),
    'color',         coalesce(t.brand_color, '#1D6A8C'),
    'logo_url',      t.brand_logo_url,
    'subtitle',      coalesce(t.brand_subtitle, t.name),
    'tagline',       t.tagline,
    'address',       t.address,
    'map_url',       t.map_url,
    'phone',         t.phone,
    'timezone',      coalesce(t.timezone, 'Asia/Kuala_Lumpur'),
    'vertical',      t.vertical,
    'hours',         t.opening_hours,
    'greeting',      coalesce(t.brand_greeting,
                       'Hi! I''m ' || coalesce(e.persona_name,'here') ||
                       '. How can I help you today?'),
    'suggestions',   coalesce(t.brand_suggestions,
                       array['What are your hours?','What do you charge?','Book an appointment']),
    'services', (
      select coalesce(json_agg(s order by s.price nulls last), '[]'::json)
      from (
        select name, description, price_local as price, currency_code as currency,
               duration_minutes as minutes
        from items
        where tenant_id = t.id and is_active
        order by price_local nulls last
      ) s
    )
  )
  from tenants t
  left join ai_employees e
    on e.tenant_id = t.id and e.status = 'active'
  where t.slug = p_slug
  limit 1;
$$;

grant execute on function get_widget_config(text) to anon, authenticated, service_role;

-- ============================================================================
-- CHECK
--   select get_widget_config('damai-clinic');
--   → should now include hours, address, tagline and the services array
--
-- CHANGING HOURS LATER (no deploy needed):
--   update tenants set opening_hours = jsonb_set(opening_hours, '{sat}',
--          '["09:00","14:00"]'::jsonb) where slug = 'damai-clinic';
-- ============================================================================
