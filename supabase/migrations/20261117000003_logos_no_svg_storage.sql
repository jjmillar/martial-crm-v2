-- Security: SVG files can carry scripts, so school logos accept only raster images from now on.
-- (Not run by the PGlite harness: no storage schema there.)
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'logos';
