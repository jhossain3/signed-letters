-- Make encryption keys immutable by denying UPDATE and DELETE
-- This prevents data loss from key deletion

CREATE POLICY "Encryption keys cannot be updated"
ON public.user_encryption_keys
FOR UPDATE
USING (false);

CREATE POLICY "Encryption keys cannot be deleted"
ON public.user_encryption_keys
FOR DELETE
USING (false);