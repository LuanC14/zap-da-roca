-- Seed: Categorias padrão do agronegócio
INSERT INTO categories (name, type, is_default) VALUES
  ('Insumos / Adubos',     'expense', true),
  ('Combustível / Diesel', 'expense', true),
  ('Maquinário',           'expense', true),
  ('Mão de Obra',          'expense', true),
  ('Venda de Safra',       'income',  true)
ON CONFLICT DO NOTHING;

-- ── Dev admin account ────────────────────────────────────────────────────────
-- ⚠️  DEV / LOCAL ONLY — seed.sql is executed only by `supabase db reset`,
--     which targets the local Docker stack. Never runs in production.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@email.com') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'admin@email.com',
      crypt('admin', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Luan","farm_name":"Fazenda Demo"}',
      '', '', '', ''
    );

    -- Set subscription active so the proxy gate doesn't block the dev account
    UPDATE public.profiles SET
      subscription_status = 'active',
      trial_ends_at       = now() + interval '1 year'
    WHERE id = '00000000-0000-0000-0000-000000000001';
  END IF;
END;
$$;
