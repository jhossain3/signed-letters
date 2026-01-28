-- Add column to track initial notification sent to external recipients
ALTER TABLE public.letters 
ADD COLUMN initial_notification_sent boolean DEFAULT false;