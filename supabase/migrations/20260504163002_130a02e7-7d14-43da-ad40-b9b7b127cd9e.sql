
-- Profiles table for reusable user info (display_name)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Deny anonymous access to profiles"
  ON public.profiles FOR ALL TO anon
  USING (false);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Physical letters table
CREATE TABLE public.physical_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  letter_id UUID REFERENCES public.letters(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  -- Plaintext content for printing (admin-readable, disclosed at checkout)
  plaintext_title TEXT NOT NULL,
  plaintext_body TEXT NOT NULL,
  plaintext_signature TEXT NOT NULL,
  delivery_date DATE NOT NULL,
  posting_date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed | refunded
  paddle_transaction_id TEXT,
  paddle_price_id TEXT,
  amount_cents INTEGER,
  currency TEXT,
  fulfillment_status TEXT NOT NULL DEFAULT 'awaiting_payment', -- awaiting_payment | queued | posted | cancelled
  posted_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_physical_letters_user ON public.physical_letters(user_id);
CREATE INDEX idx_physical_letters_posting_date ON public.physical_letters(posting_date);
CREATE INDEX idx_physical_letters_payment_status ON public.physical_letters(payment_status);

ALTER TABLE public.physical_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anonymous access to physical_letters"
  ON public.physical_letters FOR ALL TO anon
  USING (false);

CREATE POLICY "Users can view their own physical letters"
  ON public.physical_letters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own physical letters"
  ON public.physical_letters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own physical letters"
  ON public.physical_letters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_physical_letters_updated_at
  BEFORE UPDATE ON public.physical_letters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill profiles for existing users
INSERT INTO public.profiles (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
