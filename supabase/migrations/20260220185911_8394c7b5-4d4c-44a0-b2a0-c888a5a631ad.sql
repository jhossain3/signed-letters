
-- Create trigger function that inserts a placeholder row in user_encryption_keys
-- when a new user signs up. This prevents race conditions between the auth state
-- change handler (which would create a v1 key) and createAndStoreWrappedKey
-- (which tries to insert the v2 row).
CREATE OR REPLACE FUNCTION public.handle_new_user_encryption_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert a placeholder row so the client can UPDATE (upsert) it safely
  INSERT INTO public.user_encryption_keys (user_id, encryption_version)
  VALUES (NEW.id, 1)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
CREATE TRIGGER on_auth_user_created_encryption_key
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_encryption_key();
