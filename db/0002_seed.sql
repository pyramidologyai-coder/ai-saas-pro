-- ============================================================================
-- Automology MVP — migration 0002 : demo seed
--
-- Creates one demo tenant you can pitch with. Swap the values for a real
-- prospect's details before the demo — that alone makes it land far better
-- than a generic example.
--
-- Run after 0001_init.sql.
-- ============================================================================

-- ── The demo business ───────────────────────────────────────────────────────
insert into tenants (id, name, slug, email, phone, country_code, vertical,
                     status, timezone, default_language, wallet_balance_usd)
values (
  '11111111-1111-1111-1111-111111111111',
  'Sunrise Hair Studio',
  'sunrise-hair',
  'hello@sunrisehair.my',
  '+60 3 2201 8890',
  'MY',
  'salon',
  'trial',
  'Asia/Kuala_Lumpur',
  'en',
  10.0000
)
on conflict (id) do nothing;

-- ── The AI employee ─────────────────────────────────────────────────────────
-- compiled_prompt is filled by compile.py. Left null here so the first run
-- of the compiler is visible in the demo rather than pre-baked.
insert into ai_employees (id, tenant_id, agent_id, sector_id, persona_name,
                          role_name, language_default, tone, knowledge_summary, config)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'AGENT-001',
  'salon',
  'Mia',
  'AI Receptionist',
  'en',
  'Warm and chatty, never pushy. Short messages. A little humour is fine.',
  'Parking is free in the lot behind the building. Colour services need a patch test 48 hours ahead for first-time clients. Deposits of RM 100 apply to balayage and bridal only. We do not do extensions.',
  jsonb_build_object(
    'hours',        'Tue-Sat 10:00-19:00, Sun 11:00-17:00, closed Mon',
    'location',     'Jalan Kemuja, Bangsar, Kuala Lumpur',
    'booking_link', 'sunrisehair.my/book',
    'languages',    jsonb_build_array('en','ms')
  )
)
on conflict (id) do nothing;

-- ── Services ────────────────────────────────────────────────────────────────
insert into items (tenant_id, name, description, price_local, currency_code,
                   duration_minutes, is_bookable)
values
  ('11111111-1111-1111-1111-111111111111', 'Cut and blow-dry',  'Wash, cut and finish',              85.00,  'MYR',  60, true),
  ('11111111-1111-1111-1111-111111111111', 'Full colour',       'Single-process colour',            260.00, 'MYR', 120, true),
  ('11111111-1111-1111-1111-111111111111', 'Balayage',          'Hand-painted highlights. RM100 deposit.', 420.00, 'MYR', 180, true),
  ('11111111-1111-1111-1111-111111111111', 'Keratin treatment', 'Smoothing treatment',              550.00, 'MYR', 150, true),
  ('11111111-1111-1111-1111-111111111111', 'Bridal styling',    'By consultation. Deposit required.', null,  'MYR', null, true)
on conflict do nothing;

-- ── A sample conversation, so the dashboard is not empty on first load ──────
insert into customers (id, tenant_id, external_id, name, language_code)
values ('33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
        'demo-session-001', 'Aisyah', 'en')
on conflict (tenant_id, external_id) do nothing;

insert into conversations (id, tenant_id, ai_employee_id, customer_id,
                           channel, status, subject, language_code)
values ('44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333',
        'webchat', 'resolved', 'Balayage pricing and availability', 'en')
on conflict (id) do nothing;

insert into messages (tenant_id, conversation_id, sender_type, body, idempotency_key)
values
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444','customer',
   'hi, how much for balayage?', 'demo-msg-1'),
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444','ai',
   'Hi! Balayage starts at RM 420 and takes about three hours. There''s a RM 100 deposit to hold the slot. When were you thinking?', 'demo-msg-2'),
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444','customer',
   'saturday afternoon if you have it', 'demo-msg-3'),
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444','ai',
   'Saturday works — we''re open until 7pm. If this is your first colour with us you''ll need a quick patch test 48 hours before, so Thursday. Shall I put you down for 2pm Saturday?', 'demo-msg-4')
on conflict (tenant_id, idempotency_key) do nothing;

-- ── Cost record, so the margin story is demonstrable on day one ─────────────
insert into ai_decision_log (tenant_id, conversation_id, ai_employee_id,
                             decision_type, model_used, tokens_in, tokens_out,
                             cached_tokens, actual_execution_cost,
                             allocated_platform_cost, billable_usage_value,
                             latency_ms, confidence_score)
values ('11111111-1111-1111-1111-111111111111',
        '44444444-4444-4444-4444-444444444444',
        '22222222-2222-2222-2222-222222222222',
        'response_generated', 'claude-haiku-4-5', 780, 64, 630,
        0.000412, 0.001000, 0.050000, 940, 0.94)
on conflict do nothing;

-- ============================================================================
-- Sanity checks — run these after seeding.
-- ============================================================================
-- select name, vertical, status from tenants;
-- select persona_name, sector_id, compiled_tokens from ai_employees;
-- select count(*) as services from items;
-- select message_count, ai_message_count from conversations;   -- expect 4 / 2
