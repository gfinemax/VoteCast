-- 1. Add Columns to agendas table
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS presentation_type TEXT; -- 'FILE' or 'URL'
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS presentation_source TEXT; -- Public URL

-- 2. Create Storage Bucket (agenda-materials)
-- Try to create the bucket. If it fails (due to permissions), User might need to do it in Dashboard.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('agenda-materials', 'agenda-materials', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policy (Allow Public Read, Authenticated Upload)
-- Drop existing policies if any to avoid conflict names (optional, explicit creation preferred)
DROP POLICY IF EXISTS "Public Read Agenda Materials" ON storage.objects;
CREATE POLICY "Public Read Agenda Materials"
ON storage.objects FOR SELECT
USING ( bucket_id = 'agenda-materials' );

DROP POLICY IF EXISTS "Authenticated Upload Agenda Materials" ON storage.objects;
CREATE POLICY "Authenticated Upload Agenda Materials"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'agenda-materials' );

-- Update 'agendas' bucket policy just in case user re-uses it? No, keeping separate is cleaner.
