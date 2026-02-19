
CREATE OR REPLACE FUNCTION public.find_user_by_email(lookup_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  found_user_id uuid;
BEGIN
  SELECT id INTO found_user_id
  FROM auth.users
  WHERE email = lookup_email
  LIMIT 1;

  RETURN found_user_id;
END;
$$;
