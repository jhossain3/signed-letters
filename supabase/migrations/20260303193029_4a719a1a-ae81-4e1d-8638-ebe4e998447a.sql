
-- Events table
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  event_date date NOT NULL,
  location text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Event submissions table
CREATE TABLE public.event_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id),
  user_id uuid NOT NULL,
  name text NOT NULL,
  date_of_birth date,
  gender text,
  marketing_consent boolean NOT NULL DEFAULT true,
  letter_date date NOT NULL,
  posting_date date NOT NULL,
  recipient_name text NOT NULL,
  recipient_address text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS for events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active events"
  ON public.events FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- RLS for event_submissions
ALTER TABLE public.event_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own submissions"
  ON public.event_submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own submissions"
  ON public.event_submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own submissions"
  ON public.event_submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_submissions_updated_at
  BEFORE UPDATE ON public.event_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert test event
INSERT INTO public.events (name, slug, event_date, location)
VALUES ('Test Event', 'test-event', '2026-03-03', 'London');
