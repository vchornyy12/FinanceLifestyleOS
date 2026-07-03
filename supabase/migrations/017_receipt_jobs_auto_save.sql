-- 017_receipt_jobs_auto_save.sql
-- Zero-touch receipts: jobs created with auto_save=true are saved as a
-- transaction + receipt_items by the background function after parsing.
-- Default false keeps the mobile review flow unchanged.

ALTER TABLE public.receipt_parse_jobs
  ADD COLUMN auto_save boolean NOT NULL DEFAULT false;
