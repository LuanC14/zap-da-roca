-- Migration: security hardening + production data fixes
-- Idempotent: safe to re-run.

-- 1. profiles ----------------------------------------------------------------
-- Until now any logged-in user could run
--   supabase.from('profiles').update({ subscription_status: 'active', trial_ends_at: '2099-01-01' })
-- from the browser and get free access forever (RLS only checked the row, not the columns).
-- Billing and admin columns are now writable only by service_role (server code).
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, farm_name) ON public.profiles TO authenticated;

-- 2. registered_phones -------------------------------------------------------
-- "registered_phones_all" let a user INSERT their own row with verified = true for ANY number,
-- skipping the WhatsApp OTP (and hijacking messages meant for someone else).
-- Linking/unlinking now happens only through server actions using service_role.
DROP POLICY IF EXISTS "registered_phones_all" ON registered_phones;
DROP POLICY IF EXISTS "registered_phones_select" ON registered_phones;
CREATE POLICY "registered_phones_select" ON registered_phones
  FOR SELECT USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.registered_phones FROM anon, authenticated;

-- 3. phone_verifications: bind OTP to the requesting user + count wrong attempts ----
ALTER TABLE phone_verifications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE phone_verifications
  ADD COLUMN IF NOT EXISTS attempts smallint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_phone_verifications_user_created  ON phone_verifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone_created ON phone_verifications(phone, created_at);

-- 4. whatsapp_messages: dedupe Meta webhook redeliveries (service_role only) ------
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id         text PRIMARY KEY,   -- WhatsApp message id (wamid...)
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages(created_at);

-- 5. Default categories ------------------------------------------------------
-- seed.sql only runs on the local stack, so production had no global categories and
-- `!pagar 350 combustivel ...` always saved "sem categoria".
INSERT INTO categories (name, type, is_default)
SELECT v.name, v.type, true
FROM (VALUES
  ('Insumos / Adubos',     'expense'),
  ('Combustível / Diesel', 'expense'),
  ('Maquinário',           'expense'),
  ('Mão de Obra',          'expense'),
  ('Venda de Safra',       'income')
) AS v(name, type)
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.user_id IS NULL AND c.name = v.name
);

-- 6. Indexes matching the RLS filters (every query is scoped by user_id) ----------
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_work_records_user_date ON work_records(user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_employees_user         ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user        ON categories(user_id);
