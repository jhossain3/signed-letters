-- Update link_pending_letters to notify sender via pg_net using hardcoded anon key
CREATE OR REPLACE FUNCTION public.link_pending_letters()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  linked_letter RECORD;
BEGIN
  -- Link any letters that were sent to this user's email
  UPDATE public.letters
  SET recipient_user_id = NEW.id
  WHERE recipient_email = NEW.email
    AND recipient_user_id IS NULL
    AND recipient_type = 'someone';

  -- For each letter that was just linked, notify the sender
  FOR linked_letter IN
    SELECT id, user_id, recipient_email
    FROM public.letters
    WHERE recipient_email = NEW.email
      AND recipient_user_id = NEW.id
      AND recipient_type = 'someone'
  LOOP
    PERFORM net.http_post(
      url := 'https://waumaljmlmgyznlkkvia.supabase.co/functions/v1/notify-sender-recipient-joined',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdW1hbGptbG1neXpubGtrdmlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4OTY1NzYsImV4cCI6MjA4NDQ3MjU3Nn0.VVKBUl_IjFXLgEXWjU6gMIUp_j2ypy5seOyFt68YXZQ"}'::jsonb,
      body := jsonb_build_object(
        'recipientEmail', linked_letter.recipient_email,
        'senderUserId', linked_letter.user_id::text
      )
    );
  END LOOP;

  RETURN NEW;
END;
$function$;