-- Drop the overly permissive policy - we'll use service role in edge function
DROP POLICY IF EXISTS "Service role can update notification_sent" ON public.letters;