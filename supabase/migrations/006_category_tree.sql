-- Migration: 006_category_tree
-- Description: Add parent_id to categories. Replace global system categories with
-- per-user seeded trees (6 parents, 24 subcategories). Update signup trigger.
-- Seed existing users. Remap + nullify stale transaction references. Update RLS.

-- ============================================================
-- 1. Add parent_id column
-- ============================================================
ALTER TABLE public.categories
  ADD COLUMN parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE;

CREATE INDEX idx_categories_parent_id ON public.categories(parent_id);

-- ============================================================
-- 2. Seed function: creates 30 categories for one user
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_user_categories(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  income_id    UUID;
  food_id      UUID;
  housing_id   UUID;
  transport_id UUID;
  finance_id   UUID;
  personal_id  UUID;
BEGIN
  INSERT INTO public.categories (user_id, name, color, type)
    VALUES (p_user_id, 'Income', '#10B981', 'income') RETURNING id INTO income_id;
  INSERT INTO public.categories (user_id, name, color, type)
    VALUES (p_user_id, 'Food & Dining', '#F97316', 'expense') RETURNING id INTO food_id;
  INSERT INTO public.categories (user_id, name, color, type)
    VALUES (p_user_id, 'Housing & Bills', '#3B82F6', 'expense') RETURNING id INTO housing_id;
  INSERT INTO public.categories (user_id, name, color, type)
    VALUES (p_user_id, 'Transport', '#F59E0B', 'expense') RETURNING id INTO transport_id;
  INSERT INTO public.categories (user_id, name, color, type)
    VALUES (p_user_id, 'Finance', '#EF4444', 'expense') RETURNING id INTO finance_id;
  INSERT INTO public.categories (user_id, name, color, type)
    VALUES (p_user_id, 'Personal', '#8B5CF6', 'expense') RETURNING id INTO personal_id;

  INSERT INTO public.categories (user_id, name, color, type, parent_id) VALUES
    (p_user_id, 'Salary',       '#10B981', 'income', income_id),
    (p_user_id, 'Bonus',        '#10B981', 'income', income_id),
    (p_user_id, 'Freelance',    '#10B981', 'income', income_id),
    (p_user_id, 'Other Income', '#10B981', 'income', income_id);

  INSERT INTO public.categories (user_id, name, color, type, parent_id) VALUES
    (p_user_id, 'Supermarket', '#F97316', 'expense', food_id),
    (p_user_id, 'Restaurant',  '#F97316', 'expense', food_id),
    (p_user_id, 'Café',        '#F97316', 'expense', food_id),
    (p_user_id, 'Takeaway',    '#F97316', 'expense', food_id);

  INSERT INTO public.categories (user_id, name, color, type, parent_id) VALUES
    (p_user_id, 'Rent/Mortgage',    '#3B82F6', 'expense', housing_id),
    (p_user_id, 'Utilities',        '#3B82F6', 'expense', housing_id),
    (p_user_id, 'Internet & Phone', '#3B82F6', 'expense', housing_id),
    (p_user_id, 'Home Maintenance', '#3B82F6', 'expense', housing_id);

  INSERT INTO public.categories (user_id, name, color, type, parent_id) VALUES
    (p_user_id, 'Fuel',             '#F59E0B', 'expense', transport_id),
    (p_user_id, 'Car Insurance',    '#F59E0B', 'expense', transport_id),
    (p_user_id, 'Car Maintenance',  '#F59E0B', 'expense', transport_id),
    (p_user_id, 'Public Transport', '#F59E0B', 'expense', transport_id);

  INSERT INTO public.categories (user_id, name, color, type, parent_id) VALUES
    (p_user_id, 'Credit Payment',   '#EF4444', 'expense', finance_id),
    (p_user_id, 'Loan Repayment',   '#EF4444', 'expense', finance_id),
    (p_user_id, 'Savings Transfer', '#EF4444', 'expense', finance_id);

  INSERT INTO public.categories (user_id, name, color, type, parent_id) VALUES
    (p_user_id, 'Health & Medical',    '#8B5CF6', 'expense', personal_id),
    (p_user_id, 'Shopping & Clothing', '#8B5CF6', 'expense', personal_id),
    (p_user_id, 'Entertainment',       '#8B5CF6', 'expense', personal_id),
    (p_user_id, 'Education',           '#8B5CF6', 'expense', personal_id);
END;
$$;

REVOKE ALL ON FUNCTION public.seed_user_categories(UUID) FROM PUBLIC;

-- ============================================================
-- 3. Update handle_new_user trigger to call seed function
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  PERFORM public.seed_user_categories(NEW.id);
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Seed categories for existing users who have none
-- ============================================================
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN
    SELECT id FROM auth.users
    WHERE id NOT IN (
      SELECT DISTINCT user_id FROM public.categories WHERE user_id IS NOT NULL
    )
  LOOP
    PERFORM public.seed_user_categories(u.id);
  END LOOP;
END;
$$;

-- ============================================================
-- 5. Remap transaction references from old system categories
--    to matching new user-owned categories (best-effort by name).
--    Remaining mismatches are set to NULL.
-- ============================================================
UPDATE public.transactions t
SET category_id = (
  SELECT uc.id
  FROM public.categories uc
  WHERE uc.user_id = t.user_id
    AND LOWER(uc.name) = (
      SELECT LOWER(sc.name)
      FROM public.categories sc
      WHERE sc.id = t.category_id
    )
  LIMIT 1
)
WHERE t.category_id IN (SELECT id FROM public.categories WHERE user_id IS NULL);

UPDATE public.transactions
SET category_id = NULL
WHERE category_id IN (SELECT id FROM public.categories WHERE user_id IS NULL);

-- ============================================================
-- 6. Delete all system categories (user_id IS NULL)
-- ============================================================
DELETE FROM public.categories WHERE user_id IS NULL;

-- ============================================================
-- 7. Update RLS: drop old policy that exposed system defaults,
--    add simple own-only select policy
-- ============================================================
DROP POLICY IF EXISTS "categories_select_own_and_defaults" ON public.categories;

CREATE POLICY "categories_select_own"
  ON public.categories
  FOR SELECT
  USING (user_id = auth.uid());
