-- Migration: Create work_records table
CREATE TABLE IF NOT EXISTS work_records (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id            uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date              date NOT NULL,
  regular_hours          numeric(5,2) NOT NULL DEFAULT 8,
  overtime_hours         numeric(5,2) NOT NULL DEFAULT 0,
  daily_rate_snapshot    numeric(10,2) NOT NULL,
  overtime_rate_snapshot numeric(10,2) NOT NULL DEFAULT 0,
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_records_employee_date ON work_records(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_work_records_date         ON work_records(work_date);
