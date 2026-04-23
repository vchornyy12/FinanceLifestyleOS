-- Down migration for 005_category_type
-- Removes the 6 new income system categories, then drops the type column.

DELETE FROM public.categories
  WHERE user_id IS NULL
    AND name IN ('Salary', 'Freelance', 'Investments', 'Benefits', 'Rental Income', 'Other Income');

ALTER TABLE public.categories DROP COLUMN type;
