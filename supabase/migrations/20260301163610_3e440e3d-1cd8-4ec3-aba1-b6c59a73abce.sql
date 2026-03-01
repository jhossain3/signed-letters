ALTER TABLE public.letters
ADD COLUMN recipient_title text,
ADD COLUMN recipient_body text,
ADD COLUMN recipient_signature text,
ADD COLUMN recipient_sketch_data text;