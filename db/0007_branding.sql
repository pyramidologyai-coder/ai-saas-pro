-- ============================================================================
-- 0007_branding.sql — white-labelling
-- Run AFTER 0001-0006.
--
-- WHY: the widget currently hardcodes the salon's colour and name. That works
-- for one demo tenant and breaks the moment you have two customers.
--
-- After this, the widget reads branding from the database. Onboarding a new
-- customer with their own look becomes one UPDATE, no code, no deploy.
-- ============================================================================

alter table tenants
  add column if not exists brand_color      text default '#1F4E46',
  add column if not exists brand_logo_url   text,
  add column if not exists brand_greeting   text,
  add column if not exists brand_suggestions text[],
  add column if not exists brand_subtitle   text;

comment on column tenants.brand_color       is 'Hex colour for the widget header and buttons';
comment on column tenants.brand_logo_url    is 'Optional logo. Falls back to a letter avatar.';
comment on column tenants.brand_greeting    is 'First message, already visible when the widget opens';
comment on column tenants.brand_suggestions is 'Up to 3 tappable opening questions';
comment on column tenants.brand_subtitle    is 'Small line under the agent name';

-- ----------------------------------------------------------------------------
-- get_widget_config(slug) — everything the widget needs, in one call.
-- Public on purpose: this is the branding a visitor sees anyway.
-- It exposes NO customer data, NO prompt, NO costs.
-- ----------------------------------------------------------------------------
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
    'color',         coalesce(t.brand_color, '#1F4E46'),
    'logo_url',      t.brand_logo_url,
    'subtitle',      coalesce(t.brand_subtitle, t.name),
    'greeting',      coalesce(t.brand_greeting,
                       'Hi! I''m ' || coalesce(e.persona_name,'here') || '. How can I help you today?'),
    'suggestions',   coalesce(t.brand_suggestions,
                       array['What are your hours?','What do you charge?','Book an appointment'])
  )
  from tenants t
  left join ai_employees e
    on e.tenant_id = t.id and e.status = 'active'
  where t.slug = p_slug
  limit 1;
$$;

grant execute on function get_widget_config(text) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Brand the demo tenant so you can see it working immediately.
-- ----------------------------------------------------------------------------
update tenants
   set brand_color   = '#1F4E46',
       brand_subtitle = 'Sunrise Hair Studio · replies instantly',
       brand_greeting = 'Hi! I''m Aisha. How can I help you today?',
       brand_suggestions = array[
         'What are your hours?',
         'How much for balayage?',
         'Book an appointment'
       ]
 where slug = 'sunrise-hair';

-- ============================================================================
-- ONBOARDING A NEW CUSTOMER — branding is now one statement:
--
--   update tenants set
--     brand_color   = '#B8362A',
--     brand_logo_url = 'https://theirsite.com/logo.png',
--     brand_subtitle = 'Their Business · replies instantly',
--     brand_greeting = 'Hi! I''m Sara. What can I do for you?',
--     brand_suggestions = array['Opening hours?','Price list','Book a table']
--   where slug = 'their-slug';
--
-- Refresh the widget. New look. No deploy.
--
-- CHECK:
--   select get_widget_config('sunrise-hair');
-- ============================================================================
