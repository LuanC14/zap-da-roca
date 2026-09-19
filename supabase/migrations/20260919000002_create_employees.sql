-- Migration: Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  daily_rate    numeric(10,2) NOT NULL,
  overtime_rate numeric(10,2) NOT NULL,
  work_days     text[] NOT NULL DEFAULT ARRAY['seg','ter','qua','qui','sex'],
  work_hours    jsonb  NOT NULL DEFAULT '{"start":"07:00","end":"17:00"}',
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
