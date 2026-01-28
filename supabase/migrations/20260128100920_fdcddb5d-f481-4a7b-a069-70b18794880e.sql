-- Allow service role to update notification_sent (for edge function)
CREATE POLICY "Service role can update notification_sent" 
ON public.letters 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;