-- ZapRural — Schema do Banco de Dados
-- Execute no SQL Editor do Supabase

-- ── Categorias ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('expense', 'income', 'both')),
  is_default boolean NOT NULL DEFAULT false
);

-- Categorias padrão do agronegócio
INSERT INTO categories (name, type, is_default) VALUES
  ('Insumos / Adubos',    'expense', true),
  ('Combustível / Diesel','expense', true),
  ('Maquinário',          'expense', true),
  ('Mão de Obra',         'expense', true),
  ('Venda de Safra',      'income',  true)
ON CONFLICT DO NOTHING;

-- ── Funcionários ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  daily_rate numeric(10,2) NOT NULL,
  overtime_rate numeric(10,2) NOT NULL,
  work_days text[] NOT NULL DEFAULT ARRAY['seg','ter','qua','qui','sex'],
  work_hours jsonb NOT NULL DEFAULT '{"start":"07:00","end":"17:00"}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Registros de ponto / trabalho ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  regular_hours numeric(5,2) NOT NULL DEFAULT 8,
  overtime_hours numeric(5,2) NOT NULL DEFAULT 0,
  daily_rate_snapshot numeric(10,2) NOT NULL,
  overtime_rate_snapshot numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_records_employee_date ON work_records(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_work_records_date ON work_records(work_date);

-- ── Transações financeiras ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('expense', 'income')),
  amount numeric(12,2) NOT NULL,
  category_id uuid REFERENCES categories(id),
  description text,
  transaction_date date NOT NULL,
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  whatsapp_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_paid ON transactions(paid, transaction_date);

-- ── Row Level Security (RLS) — desabilitado no MVP single-tenant ─────────────
-- Habilitar quando adicionar autenticação:
-- ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE work_records ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
