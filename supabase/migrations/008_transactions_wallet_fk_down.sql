ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_transfer_endpoints,
  DROP COLUMN IF EXISTS wallet_id,
  DROP COLUMN IF EXISTS from_wallet_id,
  DROP COLUMN IF EXISTS to_wallet_id;

ALTER TABLE public.transactions
  ADD COLUMN from_account text,
  ADD COLUMN to_account   text;

DROP FUNCTION IF EXISTS public.get_wallet_balance(uuid);
