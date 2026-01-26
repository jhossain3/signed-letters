-- Add is_lined column to letters table
ALTER TABLE public.letters ADD COLUMN is_lined boolean DEFAULT true;