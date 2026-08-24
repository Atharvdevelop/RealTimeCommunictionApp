/*
# Storage policies for file-sharing bucket

1. Security
- Allow anon + authenticated to upload, read, and delete files in the
  public file-sharing bucket (shared meeting files are intentionally public).
*/

DROP POLICY IF EXISTS "file_sharing_read_all" ON storage.objects;
CREATE POLICY "file_sharing_read_all" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'file-sharing');

DROP POLICY IF EXISTS "file_sharing_upload_all" ON storage.objects;
CREATE POLICY "file_sharing_upload_all" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'file-sharing');

DROP POLICY IF EXISTS "file_sharing_delete_all" ON storage.objects;
CREATE POLICY "file_sharing_delete_all" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'file-sharing');
