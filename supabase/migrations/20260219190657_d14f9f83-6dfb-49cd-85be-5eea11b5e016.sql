-- Revert link_pending_letters to original simple form
-- Sender nudge is handled client-side during re-encryption
CREATE OR REPLACE FUNCTION public.link_pending_letters()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Link any letters that were sent to this user's email
  UPDATE public.letters
  SET recipient_user_id = NEW.id
  WHERE recipient_email = NEW.email
    AND recipient_user_id IS NULL
    AND recipient_type = 'someone';
  
  RETURN NEW;
END;
$function$;