-- Only JPG and PNG may be uploaded.
--
-- WebP stays in the allowed list because the browser converts to WebP before
-- uploading — it's the storage format, not an accepted input format. The
-- JPG/PNG rule is enforced in the upload route against the ORIGINAL file
-- type, which travels with the request.
--
-- AVIF removed: nothing produces it any more.
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'trip-media';
