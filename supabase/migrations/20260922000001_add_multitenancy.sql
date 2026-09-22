-- Migration: Multi-tenancy — add user_id to existing tables, new SaaS tables, RLS

-- 1. Add user_id to existing tables (nullable — global seed data keeps user_id NULL)
ALTER TABLE categories    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE employees     ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE transactions  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE work_records  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. profiles — one row per auth user, created automatically via trigger
CREATE TABLE IF NOT EXISTS profiles (
  id                   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name            text,
  farm_name            text,
  subscription_id      text,
  subscription_status  text NOT NULL DEFAULT 'trial'
                         CHECK (subscription_status IN ('trial','active','past_due','paused','cancelled')),
  trial_ends_at        timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  current_period_end   timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- 3. registered_phones — maps WhatsApp number → tenant
CREATE TABLE IF NOT EXISTS registered_phones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_number  text UNIQUE NOT NULL,
  verified         boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registered_phones_number ON registered_phones(whatsapp_number);

-- 4. phone_verifications — OTP codes (10-minute TTL)
CREATE TABLE IF NOT EXISTS phone_verifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      text NOT NULL,
  code       char(6) NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. payment_events — idempotency table for Mercado Pago webhooks
CREATE TABLE IF NOT EXISTS payment_events (
  id           text PRIMARY KEY,  -- MP notification data.id
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type   text NOT NULL,
  payload      jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Auto-create profile row on auth.users INSERT
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, farm_name)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'farm_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- 7. Enable RLS on all tables
ALTER TABLE categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE registered_phones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events     ENABLE ROW LEVEL SECURITY;

-- 8. RLS policies

-- categories: global defaults (user_id IS NULL) visible to all; own categories visible only to owner
DROP POLICY IF EXISTS "categories_select" ON categories;
CREATE POLICY "categories_select" ON categories FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
DROP POLICY IF EXISTS "categories_insert" ON categories;
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "categories_update" ON categories;
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "categories_delete" ON categories;
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (user_id = auth.uid());

-- employees: full CRUD for own rows only
DROP POLICY IF EXISTS "employees_all" ON employees;
CREATE POLICY "employees_all" ON employees
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- transactions: full CRUD for own rows only
DROP POLICY IF EXISTS "transactions_all" ON transactions;
CREATE POLICY "transactions_all" ON transactions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- work_records: own rows (user_id must match)
DROP POLICY IF EXISTS "work_records_all" ON work_records;
CREATE POLICY "work_records_all" ON work_records
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- profiles: read and update own profile only
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());

-- registered_phones: own rows only
DROP POLICY IF EXISTS "registered_phones_all" ON registered_phones;
CREATE POLICY "registered_phones_all" ON registered_phones
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- phone_verifications and payment_events: service-role only (no user-facing RLS)
-- (RLS enabled but no permissive policy = only service_role can access)
