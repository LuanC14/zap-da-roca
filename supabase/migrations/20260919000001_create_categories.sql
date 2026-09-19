-- Migration: Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('expense', 'income', 'both')),
  is_default boolean NOT NULL DEFAULT false
);
