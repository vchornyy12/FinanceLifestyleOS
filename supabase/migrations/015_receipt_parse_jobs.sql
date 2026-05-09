-- 015_receipt_parse_jobs.sql
-- Async OCR job queue. Parse route inserts a row and returns the id;
-- a Netlify Background Function processes it and writes result/error back.

CREATE TABLE public.receipt_parse_jobs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'processing', 'done', 'error')),
  result       jsonb,
  error_code   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.receipt_parse_jobs ENABLE ROW LEVEL SECURITY;

-- Users can read their own jobs (frontend polling).
-- Writes are done by the service-role key (background function) — RLS is bypassed
-- for service-role clients, so no write policy is needed here.
CREATE POLICY "users_read_own_jobs"
  ON public.receipt_parse_jobs
  FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX idx_receipt_parse_jobs_user_status
  ON public.receipt_parse_jobs (user_id, status);
