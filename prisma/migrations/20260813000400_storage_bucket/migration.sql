-- ═══════════════════════════════════════════════════════════════════════
-- Storage bucket for trip photos.
--
-- Public read: these are marketing images on a public page, and serving
-- them through signed URLs would mean re-signing on every render for no
-- security benefit.
--
-- No write policies are created on purpose. Uploads go through our own
-- route handler, which checks requireAdmin() and then uses the service-role
-- key. That keeps a single, auditable path for writes — a browser holding
-- the anon key can't push files into the bucket at all.
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-media',
  'trip-media',
  true,
  -- 8 MB. Photos are compressed client-side to a few hundred KB before
  -- upload; this is the backstop for anything that slips past.
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
