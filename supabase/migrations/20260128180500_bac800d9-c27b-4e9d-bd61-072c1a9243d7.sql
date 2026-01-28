-- Add explicit deny policy for anonymous (unauthenticated) users on letters table
-- This provides defense-in-depth against potential RLS bypasses

CREATE POLICY "Deny anonymous access to letters" 
ON public.letters 
FOR ALL 
TO anon 
USING (false);

-- Also add explicit deny for anonymous users on user_encryption_keys for completeness
CREATE POLICY "Deny anonymous access to encryption keys" 
ON public.user_encryption_keys 
FOR ALL 
TO anon 
USING (false);