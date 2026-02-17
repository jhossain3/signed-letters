

## Upload Photos to Cloud Storage on Seal

Photos will be kept as in-memory `File` objects (not base64) during editing, with local object URLs for preview. On seal, they are uploaded to a cloud storage bucket, and only the resulting public URLs are saved to the database. Photos are completely excluded from localStorage.

### What Will Change

**For the user:**
- Attaching photos works the same -- select files, see previews
- On page refresh, photos are gone (user can re-add them)
- On seal, a brief upload step occurs before saving
- Sealed letters display photos from cloud URLs

### Technical Details

**1. Create storage bucket (SQL migration)**

Create a public `letter-photos` bucket with RLS policies:
- Authenticated users can upload
- Anyone can read (public bucket for display)
- Users can delete files in their own folder

**2. Update `src/pages/WriteLetter.tsx`**

- Change `photos` state from `string[]` (base64) to `File[]` (raw File objects)
- Create a separate `photoPreviewUrls` state (`string[]`) using `URL.createObjectURL()` for display during editing
- Clean up object URLs on unmount or removal
- Remove `photos` from the `LetterDraft` interface and `saveDraft()` -- photos never touch localStorage
- Remove `setPhotos(draft.photos)` from draft restore
- `handlePhotoUpload`: store the raw `File` objects instead of reading as base64
- `removePhoto`: revoke the object URL when removing
- In `completeSeal`, before calling `addLetter`:
  1. Upload each `File` to `letter-photos/{userId}/{uuid}.{ext}`
  2. Collect the public URLs
  3. Pass URL array to `addLetter`

The upload helper:

```text
uploadPhotosToStorage(files: File[], userId: string) -> string[]
  for each file:
    generate path: {userId}/{uuid}.{extension}
    upload to "letter-photos" bucket
    get public URL
    collect URL
  return all URLs
```

- Photo preview thumbnails in the editor will use `photoPreviewUrls` (object URLs) instead of base64 strings

**3. No changes needed elsewhere**

- `useLetters.ts` already stores whatever strings are in the `photos` array -- URLs work as-is
- `EnvelopeOpening.tsx` renders `<img src={...}>` which works for URLs
- Existing sealed letters with base64 photos continue to display correctly

### Files to modify
- New SQL migration -- create `letter-photos` bucket and RLS policies
- `src/pages/WriteLetter.tsx` -- switch to File objects, remove photos from draft, add upload-on-seal logic
