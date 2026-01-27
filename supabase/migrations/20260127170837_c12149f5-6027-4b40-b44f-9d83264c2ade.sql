-- Create table to store user encryption keys (encrypted at rest by Supabase)
CREATE TABLE public.user_encryption_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  encrypted_key TEXT NOT NULL, -- Base64-encoded encrypted key
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_encryption_keys ENABLE ROW LEVEL SECURITY;

-- Users can only access their own key
CREATE POLICY "Users can view their own encryption key"
ON public.user_encryption_keys
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own encryption key"
ON public.user_encryption_keys
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_encryption_keys_updated_at
BEFORE UPDATE ON public.user_encryption_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();