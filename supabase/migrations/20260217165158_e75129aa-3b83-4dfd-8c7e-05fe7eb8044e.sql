
-- Make the bucket private
UPDATE storage.buckets SET public = false WHERE id = 'letter-photos';

-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Anyone can read letter photos" ON storage.objects;

-- Allow users to read photos in their own folder (they uploaded them)
CREATE POLICY "Users can read their own uploaded photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'letter-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow recipients to read photos attached to letters sent to them
-- Photos are stored as {sender_user_id}/{uuid}.{ext}
-- We check if the current user is a recipient of any letter that references this photo URL
CREATE POLICY "Recipients can read photos from letters sent to them"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'letter-photos'
  AND EXISTS (
    SELECT 1 FROM public.letters
    WHERE letters.recipient_user_id = auth.uid()
      AND letters.photos IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(letters.photos) AS photo_url
        WHERE photo_url LIKE '%' || storage.objects.name
      )
  )
);
