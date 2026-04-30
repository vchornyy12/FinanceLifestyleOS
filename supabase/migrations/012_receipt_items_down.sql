-- 012_receipt_items_down.sql
DROP INDEX IF EXISTS idx_receipt_items_transaction;
DROP INDEX IF EXISTS idx_receipt_items_user_category;
DROP INDEX IF EXISTS idx_receipt_items_user_name;
DROP POLICY IF EXISTS "users manage own receipt items" ON public.receipt_items;
DROP TABLE IF EXISTS public.receipt_items;
