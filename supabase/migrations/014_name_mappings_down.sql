-- 014_name_mappings_down.sql

DROP INDEX IF EXISTS idx_user_name_mappings_category;
DROP INDEX IF EXISTS idx_user_name_mappings_user_raw;
DROP INDEX IF EXISTS idx_user_name_mappings_lookup;
DROP POLICY IF EXISTS "user_name_mappings_all" ON public.receipt_item_name_mappings;
DROP TABLE IF EXISTS public.receipt_item_name_mappings;

DROP INDEX IF EXISTS idx_global_name_mappings_pattern;
DROP INDEX IF EXISTS idx_global_name_mappings_retailer_pattern;
DROP POLICY IF EXISTS "global_name_mappings_select" ON public.global_retailer_name_mappings;
DROP TABLE IF EXISTS public.global_retailer_name_mappings;
