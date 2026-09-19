-- Migration: Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type                 text NOT NULL CHECK (type IN ('expense', 'income')),
  amount               numeric(12,2) NOT NULL,
  category_id          uuid REFERENCES categories(id),
  description          text,
  transaction_date     date NOT NULL,
  paid                 boolean NOT NULL DEFAULT false,
  paid_at              timestamptz,
  whatsapp_message_id  text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_paid ON transactions(paid, transaction_date);
