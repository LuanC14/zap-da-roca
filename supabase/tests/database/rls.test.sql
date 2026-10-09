-- Row-level-security regression tests. Run with: supabase test db   (needs Docker)
-- Two tenants (A, B); every assertion runs as the `authenticated` role with A's JWT.

begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- ── Fixtures (as postgres, bypasses RLS) ─────────────────────────────────────
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'a@test.dev', crypt('x', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Tenant A"}', '', '', '', ''),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'b@test.dev', crypt('x', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Tenant B"}', '', '', '', '');

insert into categories (name, type, user_id) values
  ('Categoria A', 'expense', 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('Categoria B', 'expense', 'bbbbbbbb-0000-0000-0000-00000000000b');

insert into employees (name, daily_rate, overtime_rate, user_id) values
  ('Funcionario A', 100, 15, 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('Funcionario B', 200, 30, 'bbbbbbbb-0000-0000-0000-00000000000b');

insert into transactions (type, amount, transaction_date, user_id) values
  ('expense', 10, current_date, 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('expense', 20, current_date, 'bbbbbbbb-0000-0000-0000-00000000000b');

insert into registered_phones (user_id, whatsapp_number, verified) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '5511900000001', true),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '5511900000002', true);

insert into phone_verifications (user_id, phone, code) values
  ('bbbbbbbb-0000-0000-0000-00000000000b', '5511900000002', '123456');
insert into whatsapp_messages (id) values ('wamid.test');
insert into payment_events (id, event_type, payload) values ('evt-1', 'test', '{}');

-- ── Migrations seeded what production needs ─────────────────────────────────
select ok(
  exists (select 1 from categories where name = 'Combustível / Diesel' and user_id is null),
  'default global categories exist after migrations'
);
select is(
  (select count(*) from categories where user_id is null and name = 'Mão de Obra'),
  1::bigint,
  'default categories are not duplicated'
);

-- ── Act as tenant A ──────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- Profiles: signup trigger created one per user; only mine is visible
select is((select count(*) from profiles), 1::bigint, 'A sees only its own profile');

-- Billing columns cannot be self-edited (free-subscription exploit)
select throws_ok(
  $$update profiles set subscription_status = 'active' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A cannot set its own subscription_status');
select throws_ok(
  $$update profiles set trial_ends_at = now() + interval '10 years' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A cannot extend its own trial');
select throws_ok(
  $$update profiles set current_period_end = now() + interval '10 years' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A cannot set its own current_period_end');
select throws_ok(
  $$update profiles set is_admin = true where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A cannot promote itself to admin');
select lives_ok(
  $$update profiles set full_name = 'Novo Nome', farm_name = 'Fazenda Nova' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  'A can still edit its own name and farm');
select lives_ok(
  $$update profiles set full_name = 'hack' where id = 'bbbbbbbb-0000-0000-0000-00000000000b'$$,
  'A''s update on B''s profile is silently filtered by RLS');

-- WhatsApp linking only through the OTP flow (service role)
select throws_ok(
  $$insert into registered_phones (user_id, whatsapp_number, verified) values ('aaaaaaaa-0000-0000-0000-00000000000a', '5511977770000', true)$$,
  '42501', null, 'A cannot insert a verified phone directly (OTP bypass)');
select throws_ok(
  $$update registered_phones set whatsapp_number = '5511977770001' where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A cannot rewrite its linked number');
select throws_ok(
  $$delete from registered_phones where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A cannot delete phones directly');
select is((select count(*) from registered_phones), 1::bigint, 'A reads only its own linked phone');

-- Tenant data isolation
select is((select count(*) from transactions), 1::bigint, 'A sees only its own transactions');
select is((select count(*) from employees), 1::bigint, 'A sees only its own employees');
select results_eq(
  $$select name from categories where name like 'Categoria %' order by name$$,
  $$values ('Categoria A'::text)$$,
  'A sees its own custom categories but not B''s');
select ok(
  exists (select 1 from categories where name = 'Combustível / Diesel'),
  'A still sees the global categories');

select throws_ok(
  $$insert into transactions (type, amount, transaction_date, user_id) values ('expense', 1, current_date, 'bbbbbbbb-0000-0000-0000-00000000000b')$$,
  '42501', null, 'A cannot write rows for B');
select lives_ok(
  $$update transactions set paid = true where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'$$,
  'A''s update on B''s transactions is silently filtered by RLS');
select lives_ok(
  $$delete from employees where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'$$,
  'A''s delete on B''s employees is silently filtered by RLS');

-- Server-only tables expose nothing to users
select is((select count(*) from phone_verifications), 0::bigint, 'OTP codes are invisible to users');
select is(
  (select (select count(*) from whatsapp_messages) + (select count(*) from payment_events)),
  0::bigint, 'webhook dedupe and payment tables are invisible to users');

-- ── Back to postgres: B's data must be untouched by A's attempts ──────────────
reset role;
select is((select full_name from profiles where id = 'bbbbbbbb-0000-0000-0000-00000000000b'),
  'Tenant B', 'B''s profile was not modified by A');
select is((select paid from transactions where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'),
  false, 'B''s transaction was not modified by A');
select is((select count(*) from employees where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'),
  1::bigint, 'B''s employee was not deleted by A');

select * from finish();
rollback;
