-- 017_receipt_jobs_auto_save_down.sql
ALTER TABLE public.receipt_parse_jobs
  DROP COLUMN IF EXISTS auto_save;
