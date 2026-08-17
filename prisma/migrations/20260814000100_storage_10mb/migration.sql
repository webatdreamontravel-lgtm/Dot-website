-- Raise the storage ceiling to 10 MB, matching MAX_UPLOAD_MB in
-- lib/uploadImage.ts and MAX_BYTES in the upload route.
--
-- The browser shrinks photos before uploading, so files arriving here are
-- typically ~1 MB. This is the backstop for when that shrinking is skipped
-- or fails.
UPDATE storage.buckets
   SET file_size_limit = 10485760
 WHERE id = 'trip-media';
