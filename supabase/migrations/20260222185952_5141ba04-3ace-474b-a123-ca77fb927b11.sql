
-- Create table for custom font glyphs
CREATE TABLE public.custom_font_glyphs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character TEXT NOT NULL,
  stroke_data TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, character)
);

-- Enable RLS
ALTER TABLE public.custom_font_glyphs ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only CRUD their own glyphs
CREATE POLICY "Deny anonymous access to glyphs"
ON public.custom_font_glyphs
AS RESTRICTIVE
FOR ALL
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view their own glyphs"
ON public.custom_font_glyphs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own glyphs"
ON public.custom_font_glyphs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own glyphs"
ON public.custom_font_glyphs
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own glyphs"
ON public.custom_font_glyphs
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_custom_font_glyphs_updated_at
BEFORE UPDATE ON public.custom_font_glyphs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
