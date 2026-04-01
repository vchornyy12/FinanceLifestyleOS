-- Rollback: 001_initial_schema
-- Reverses all objects created in 001_initial_schema.sql

-- Drop trigger and function first (depends on auth.users)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop tables in dependency order (transactions → categories → profiles)
DROP TABLE IF EXISTS public.transactions;
DROP TABLE IF EXISTS public.categories;
DROP TABLE IF EXISTS public.profiles;

-- Drop enum
DROP TYPE IF EXISTS public.transaction_source;
