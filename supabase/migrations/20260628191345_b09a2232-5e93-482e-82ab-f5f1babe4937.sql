
-- 1. Fix link_pending_letters to point at the correct project
CREATE OR REPLACE FUNCTION public.link_pending_letters()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  linked_letter RECORD;
BEGIN
  UPDATE public.letters
  SET recipient_user_id = NEW.id
  WHERE recipient_email = NEW.email
    AND recipient_user_id IS NULL
    AND recipient_type = 'someone';

  FOR linked_letter IN
    SELECT id, user_id, recipient_email
    FROM public.letters
    WHERE recipient_email = NEW.email
      AND recipient_user_id = NEW.id
      AND recipient_type = 'someone'
  LOOP
    PERFORM net.http_post(
      url := 'https://csyaldzceaphofycxkjy.supabase.co/functions/v1/notify-sender-recipient-joined',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzeWFsZHpjZWFwaG9meWN4a2p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NDY0MzgsImV4cCI6MjA4NzQyMjQzOH0.b1gK7yKtwSC5J0svON9b42iK5yc04E86beO9Rhejqxw"}'::jsonb,
      body := jsonb_build_object(
        'recipientEmail', linked_letter.recipient_email,
        'senderUserId', linked_letter.user_id::text
      )
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 2. Remove the bad cron job pointing at the wrong project
SELECT cron.unschedule('daily-letter-notifications')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-letter-notifications');

-- 3. Re-schedule it against the correct project
SELECT cron.schedule(
  'daily-letter-notifications',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://csyaldzceaphofycxkjy.supabase.co/functions/v1/send-letter-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzeWFsZHpjZWFwaG9meWN4a2p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NDY0MzgsImV4cCI6MjA4NzQyMjQzOH0.b1gK7yKtwSC5J0svON9b42iK5yc04E86beO9Rhejqxw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
