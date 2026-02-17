
-- Add status column to letters table
ALTER TABLE public.letters ADD COLUMN status text NOT NULL DEFAULT 'draft';

-- Update all existing letters to 'sealed' (they were all sealed before this feature)
UPDATE public.letters SET status = 'sealed';

-- Add an index for efficient filtering by status and user
CREATE INDEX idx_letters_status ON public.letters (status);
CREATE INDEX idx_letters_user_status ON public.letters (user_id, status);
