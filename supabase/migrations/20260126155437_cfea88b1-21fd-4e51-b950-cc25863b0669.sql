-- Create table for storing verified phone numbers
CREATE TABLE public.user_phones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  phone_number TEXT NOT NULL UNIQUE,
  country_code TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for pending phone verifications (before account creation)
CREATE TABLE public.pending_phone_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  country_code TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  otp_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email),
  UNIQUE(phone_number)
);

-- Enable RLS on user_phones
ALTER TABLE public.user_phones ENABLE ROW LEVEL SECURITY;

-- Users can only view their own phone record
CREATE POLICY "Users can view their own phone"
ON public.user_phones
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own phone (for re-verification)
CREATE POLICY "Users can update their own phone"
ON public.user_phones
FOR UPDATE
USING (auth.uid() = user_id);

-- Enable RLS on pending verifications (service role only)
ALTER TABLE public.pending_phone_verifications ENABLE ROW LEVEL SECURITY;

-- No public access to pending verifications - only via edge functions with service role

-- Add trigger for updated_at on user_phones
CREATE TRIGGER update_user_phones_updated_at
BEFORE UPDATE ON public.user_phones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_user_phones_phone ON public.user_phones(phone_number);
CREATE INDEX idx_pending_verifications_phone ON public.pending_phone_verifications(phone_number);
CREATE INDEX idx_pending_verifications_email ON public.pending_phone_verifications(email);