-- Migration: 005_category_type
-- Description: Add type column to categories ('expense' | 'income' | 'any').
-- Backfills existing 10 expense-only system categories, sets 2 to 'any',
-- and seeds 6 new income system categories.

-- 1. Add column with DEFAULT so existing rows get 'expense'
ALTER TABLE public.categories
  ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'
    CHECK (type IN ('expense', 'income', 'any'));

-- 2. Two system categories belong to both types
UPDATE public.categories SET type = 'any'
  WHERE user_id IS NULL AND name IN ('Savings & Investments', 'Other');

-- 3. Seed 6 income system categories
INSERT INTO public.categories (name, color, type) VALUES
  ('Salary',        '#10B981', 'income'),
  ('Freelance',     '#06B6D4', 'income'),
  ('Investments',   '#3B82F6', 'income'),
  ('Benefits',      '#8B5CF6', 'income'),
  ('Rental Income', '#F97316', 'income'),
  ('Other Income',  '#6B7280', 'income');
