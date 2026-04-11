-- Migration 006: Add first_name, last_name, phone to profiles
-- Run this in the Supabase SQL editor before deploying.

-- Add new columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;

-- Migrate existing full_name data into first_name/last_name
UPDATE profiles
SET first_name = split_part(full_name, ' ', 1),
    last_name = CASE
      WHEN position(' ' in full_name) > 0
      THEN substring(full_name from position(' ' in full_name) + 1)
      ELSE NULL
    END
WHERE full_name IS NOT NULL AND first_name IS NULL;

-- Update the handle_new_user trigger to set role_selected = false for new signups
-- (This ensures both email and Google signups start with role_selected = false)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, role_selected)
  VALUES (new.id, new.email, 'trainee', false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
