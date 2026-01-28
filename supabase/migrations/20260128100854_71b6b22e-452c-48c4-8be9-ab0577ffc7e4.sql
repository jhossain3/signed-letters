-- Add column to track if notification has been sent
ALTER TABLE public.letters 
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false;

-- Create index for efficient querying of letters needing notifications
CREATE INDEX IF NOT EXISTS idx_letters_delivery_notification 
ON public.letters (delivery_date, notification_sent) 
WHERE notification_sent = false;