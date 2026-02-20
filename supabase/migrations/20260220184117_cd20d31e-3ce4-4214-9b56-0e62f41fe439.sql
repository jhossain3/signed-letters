
-- Add v2 encryption columns to user_encryption_keys
ALTER TABLE user_encryption_keys
  ADD COLUMN IF NOT EXISTS wrapped_key text,
  ADD COLUMN IF NOT EXISTS salt text,
  ADD COLUMN IF NOT EXISTS encryption_version integer DEFAULT 1;

-- Make encrypted_key nullable so v2 users can have it nulled after migration
ALTER TABLE user_encryption_keys ALTER COLUMN encrypted_key DROP NOT NULL;

-- Drop the restrictive UPDATE policy that blocks all updates
DROP POLICY IF EXISTS "Encryption keys cannot be updated" ON user_encryption_keys;

-- Add permissive UPDATE policy: users can only update their own row
CREATE POLICY "Users can update their own encryption key"
  ON user_encryption_keys
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Security definer function to fetch KDF parameters before authentication
-- (pre-auth RLS would otherwise block the read)
CREATE OR REPLACE FUNCTION public.get_encryption_metadata_by_email(lookup_email text)
RETURNS TABLE(salt text, wrapped_key text, encryption_version integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  found_user_id uuid;
BEGIN
  SELECT id INTO found_user_id FROM auth.users WHERE email = lookup_email LIMIT 1;
  IF found_user_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT uek.salt, uek.wrapped_key, uek.encryption_version
    FROM user_encryption_keys uek
    WHERE uek.user_id = found_user_id;
END;
$$;
