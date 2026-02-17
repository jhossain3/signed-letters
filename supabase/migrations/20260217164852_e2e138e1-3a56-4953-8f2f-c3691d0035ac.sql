
-- Create letter-photos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('letter-photos', 'letter-photos', true);

-- Authenticated users can upload photos
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'letter-photos');

-- Anyone can read letter photos (public bucket)
CREATE POLICY "Anyone can read letter photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'letter-photos');

-- Users can delete their own photos (folder matches their user id)
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'letter-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
