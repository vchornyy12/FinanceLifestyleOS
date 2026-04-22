-- Rollback for 004_transaction_type
-- Drop in reverse order of creation.

DROP INDEX IF EXISTS idx_transactions_user_type_date;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_transfer_endpoints;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_amount_positive;

ALTER TABLE public.transactions DROP COLUMN IF EXISTS to_account;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS from_account;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS type;

DROP TYPE IF EXISTS public.transaction_type;
