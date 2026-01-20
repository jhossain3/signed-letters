-- Create letters table
CREATE TABLE public.letters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  date TEXT NOT NULL,
  delivery_date TIMESTAMPTZ NOT NULL,
  signature TEXT NOT NULL,
  signature_font TEXT,
  recipient_email TEXT,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('myself', 'someone')),
  photos TEXT[] DEFAULT '{}',
  sketch_data TEXT,
  is_typed BOOLEAN DEFAULT true,
  paper_color TEXT,
  ink_color TEXT,
  type TEXT NOT NULL CHECK (type IN ('sent', 'received')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own letters" 
ON public.letters 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own letters" 
ON public.letters 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own letters" 
ON public.letters 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own letters" 
ON public.letters 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_letters_updated_at
BEFORE UPDATE ON public.letters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();