-- Migration: 001_initial_schema
-- Description: Create core schema — profiles, categories (with 12 seeded defaults), transactions
-- and the auto-profile trigger for new auth users.

-- ============================================================
-- ENUM: transaction_source
-- ============================================================
CREATE TYPE public.transaction_source AS ENUM (
  'manual',
  'bank_sync',
  'ocr'
);

-- ============================================================
-- TABLE: profiles
-- Extends auth.users with application-level profile data.
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

-- ============================================================
-- TABLE: categories
-- Supports both system-default categories (user_id IS NULL)
-- and user-defined categories (user_id = <user uuid>).
-- ============================================================
CREATE TABLE public.categories (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  color       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

-- ============================================================
-- TABLE: transactions
-- ============================================================
CREATE TABLE public.transactions (
  id          UUID                     NOT NULL DEFAULT gen_random_uuid(),
  user_id     UUID                     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC(12, 2)           NOT NULL,
  merchant    TEXT                     NOT NULL,
  category_id UUID                     REFERENCES public.categories(id) ON DELETE SET NULL,
  date        DATE                     NOT NULL,
  note        TEXT,
  source      public.transaction_source NOT NULL DEFAULT 'manual',
  created_at  TIMESTAMPTZ              NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ              NOT NULL DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_transactions_user_id  ON public.transactions(user_id);
CREATE INDEX idx_transactions_date     ON public.transactions(date DESC);
CREATE INDEX idx_categories_user_id    ON public.categories(user_id);

-- ============================================================
-- SEED: 12 default system categories (user_id = NULL)
-- ============================================================
INSERT INTO public.categories (name, color) VALUES
  ('Food & Dining',        '#EF4444'),
  ('Transport',            '#F97316'),
  ('Shopping',             '#EAB308'),
  ('Entertainment',        '#22C55E'),
  ('Health & Fitness',     '#14B8A6'),
  ('Housing',              '#3B82F6'),
  ('Utilities',            '#8B5CF6'),
  ('Education',            '#EC4899'),
  ('Travel',               '#06B6D4'),
  ('Personal Care',        '#F59E0B'),
  ('Savings & Investments','#10B981'),
  ('Other',                '#6B7280');

-- ============================================================
-- FUNCTION + TRIGGER: auto-create profile on new user signup
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
