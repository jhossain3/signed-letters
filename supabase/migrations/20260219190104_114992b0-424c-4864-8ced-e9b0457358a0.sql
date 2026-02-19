-- Update link_pending_letters to also trigger sender nudge notification
CREATE OR REPLACE FUNCTION public.link_pending_letters()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  linked_letter RECORD;
  edge_function_url TEXT;
  service_role_key TEXT;
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
    -- Call the sender nudge edge function via pg_net
    SELECT current_setting('app.settings.supabase_url', true) INTO edge_function_url;
    SELECT current_setting('app.settings.service_role_key', true) INTO service_role_key;
    
    IF edge_function_url IS NOT NULL AND service_role_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := edge_function_url || '/functions/v1/notify-sender-recipient-joined',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'recipientEmail', linked_letter.recipient_email,
          'senderUserId', linked_letter.user_id::text
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;