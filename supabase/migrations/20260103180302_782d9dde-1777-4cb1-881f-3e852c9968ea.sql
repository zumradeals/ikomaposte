-- Remove old permissive storage policies
DROP POLICY IF EXISTS "Anyone can upload worker photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update worker photos" ON storage.objects;
DROP POLICY IF EXISTS "Worker photos are publicly accessible" ON storage.objects;