-- Rollback: 002_rls_policies
-- Drops all RLS policies created in 002_rls_policies.sql and disables RLS.

-- ============================================================
-- TRANSACTIONS — remove policies, disable RLS
-- ============================================================
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete_own" ON public.transactions;

ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- CATEGORIES — remove policies, disable RLS
-- ============================================================
DROP POLICY IF EXISTS "categories_select_own_and_defaults" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_own"              ON public.categories;
DROP POLICY IF EXISTS "categories_update_own"              ON public.categories;
DROP POLICY IF EXISTS "categories_delete_own"              ON public.categories;

ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES — remove policies, disable RLS
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
