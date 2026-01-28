-- Add recipient_user_id column to track when recipients create accounts
ALTER TABLE public.letters 
ADD COLUMN recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for efficient lookup of letters by recipient
CREATE INDEX idx_letters_recipient_user_id ON public.letters(recipient_user_id);
CREATE INDEX idx_letters_recipient_email ON public.letters(recipient_email);

-- Update RLS policy to allow recipients to view letters sent to them
DROP POLICY IF EXISTS "Users can view their own letters" ON public.letters;

CREATE POLICY "Users can view their own letters or letters sent to them"
ON public.letters
FOR SELECT
USING (
  auth.uid() = user_id 
  OR auth.uid() = recipient_user_id
);

-- Create function to link pending letters when a user signs up
CREATE OR REPLACE FUNCTION public.link_pending_letters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Link any letters that were sent to this user's email
  UPDATE public.letters
  SET recipient_user_id = NEW.id
  WHERE recipient_email = NEW.email
    AND recipient_user_id IS NULL
    AND recipient_type = 'someone';
  
  RETURN NEW;
END;
$$;

-- Create trigger that runs when a new user is created in auth.users
CREATE TRIGGER on_auth_user_created_link_letters
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_pending_letters();