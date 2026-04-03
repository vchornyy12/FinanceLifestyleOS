-- Rollback migration 003: drop receipt storage policies, bucket, and column

DROP POLICY IF EXISTS "Users can upload their own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own receipts" ON storage.objects;

DELETE FROM storage.buckets WHERE id = 'receipts';

ALTER TABLE public.transactions DROP COLUMN IF EXISTS receipt_url;
