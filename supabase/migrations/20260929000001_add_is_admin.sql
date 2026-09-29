-- Migration: add is_admin flag to profiles
-- Admins bypass the subscription gate entirely.
-- Set manually in Supabase dashboard after first signup.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Only service_role (supabaseAdmin) can write this column — users cannot promote themselves.
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );
