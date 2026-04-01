-- Migration: 002_rls_policies
-- Description: Enable Row Level Security on all tables and define per-user access policies.

-- ============================================================
-- PROFILES — RLS
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Users can insert their own profile (e.g. trigger or client-side upsert)
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can delete their own profile
CREATE POLICY "profiles_delete_own"
  ON public.profiles
  FOR DELETE
  USING (id = auth.uid());

-- ============================================================
-- CATEGORIES — RLS
-- ============================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Users can see system defaults (user_id IS NULL) and their own categories
CREATE POLICY "categories_select_own_and_defaults"
  ON public.categories
  FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

-- Users can create categories for themselves only
CREATE POLICY "categories_insert_own"
  ON public.categories
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own categories only (not system defaults)
CREATE POLICY "categories_update_own"
  ON public.categories
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own categories only (not system defaults)
CREATE POLICY "categories_delete_own"
  ON public.categories
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- TRANSACTIONS — RLS
-- ============================================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "transactions_select_own"
  ON public.transactions
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own transactions
CREATE POLICY "transactions_insert_own"
  ON public.transactions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own transactions
CREATE POLICY "transactions_update_own"
  ON public.transactions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own transactions
CREATE POLICY "transactions_delete_own"
  ON public.transactions
  FOR DELETE
  USING (user_id = auth.uid());
