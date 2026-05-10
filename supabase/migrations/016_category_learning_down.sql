-- 016_category_learning_down.sql
DROP FUNCTION IF EXISTS public.upsert_category_learning(uuid,text,text,text,uuid,boolean);
DROP FUNCTION IF EXISTS public.lookup_category_from_history(uuid,text,text,text);
DROP INDEX IF EXISTS public.idx_user_name_mappings_normalized_trgm;
-- pg_trgm extension intentionally NOT dropped — may be used elsewhere.
