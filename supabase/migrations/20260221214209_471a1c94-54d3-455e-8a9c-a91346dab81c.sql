
-- Add recovery key columns to user_encryption_keys
ALTER TABLE public.user_encryption_keys
  ADD COLUMN IF NOT EXISTS recovery_wrapped_key TEXT,
  ADD COLUMN IF NOT EXISTS recovery_key_salt TEXT;

-- RPC to fetch recovery metadata by email (SECURITY DEFINER, same pattern as existing)
CREATE OR REPLACE FUNCTION public.get_recovery_metadata_by_email(lookup_email text)
  RETURNS TABLE(recovery_wrapped_key text, recovery_key_salt text, encryption_version integer)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  found_user_id uuid;
BEGIN
  SELECT id INTO found_user_id FROM auth.users WHERE email = lookup_email LIMIT 1;
  IF found_user_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT uek.recovery_wrapped_key, uek.recovery_key_salt, uek.encryption_version
    FROM user_encryption_keys uek
    WHERE uek.user_id = found_user_id;
END;
$function$;
