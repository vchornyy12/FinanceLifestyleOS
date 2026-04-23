-- Down migration for 006_category_tree
-- Drops parent_id column and restores old RLS select policy.
-- Does NOT restore system categories or remove seeded user categories.

DROP POLICY IF EXISTS "categories_select_own" ON public.categories;

CREATE POLICY "categories_select_own_and_defaults"
  ON public.categories
  FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

DROP INDEX IF EXISTS public.idx_categories_parent_id;

ALTER TABLE public.categories DROP COLUMN parent_id;

DROP FUNCTION IF EXISTS public.seed_user_categories(UUID);
