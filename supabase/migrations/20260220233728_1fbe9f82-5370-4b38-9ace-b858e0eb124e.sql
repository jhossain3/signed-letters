
-- Add RSA key columns to user_encryption_keys
ALTER TABLE public.user_encryption_keys
  ADD COLUMN IF NOT EXISTS wrapped_rsa_private_key text,
  ADD COLUMN IF NOT EXISTS rsa_private_key_iv text,
  ADD COLUMN IF NOT EXISTS rsa_public_key text,
  ADD COLUMN IF NOT EXISTS has_rsa_keys boolean NOT NULL DEFAULT false;

-- Add per-letter envelope encryption columns to letters
ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS sender_wrapped_content_key text,
  ADD COLUMN IF NOT EXISTS recipient_wrapped_content_key text;

-- RPC to fetch a recipient's RSA public key by email (public key is public)
CREATE OR REPLACE FUNCTION public.get_rsa_public_key_by_email(lookup_email text)
RETURNS TABLE(rsa_public_key text, has_rsa_keys boolean)
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
    SELECT uek.rsa_public_key, uek.has_rsa_keys
    FROM user_encryption_keys uek
    WHERE uek.user_id = found_user_id;
END;
$$;
