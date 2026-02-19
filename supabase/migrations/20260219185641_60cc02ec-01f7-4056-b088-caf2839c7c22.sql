-- Add recipient_encrypted column to track re-encryption state
-- Default false, does not modify existing rows
ALTER TABLE public.letters ADD COLUMN recipient_encrypted boolean DEFAULT false;