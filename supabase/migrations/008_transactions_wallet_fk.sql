ALTER TABLE public.transactions
  ADD COLUMN wallet_id      uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  ADD COLUMN from_wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  ADD COLUMN to_wallet_id   uuid REFERENCES public.wallets(id) ON DELETE SET NULL;

ALTER TABLE public.transactions
  DROP COLUMN IF EXISTS from_account,
  DROP COLUMN IF EXISTS to_account;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_transfer_endpoints;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transfer_endpoints CHECK (
    (type = 'transfer' AND from_wallet_id IS NOT NULL AND to_wallet_id IS NOT NULL AND wallet_id IS NULL)
    OR
    (type <> 'transfer' AND from_wallet_id IS NULL AND to_wallet_id IS NULL)
  );

CREATE OR REPLACE FUNCTION public.get_wallet_balance(p_wallet_id uuid)
RETURNS numeric(14,2)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    w.opening_balance
    + COALESCE((SELECT SUM(amount) FROM transactions WHERE wallet_id = p_wallet_id AND type = 'income'), 0)
    - COALESCE((SELECT SUM(amount) FROM transactions WHERE wallet_id = p_wallet_id AND type = 'expense'), 0)
    + COALESCE((SELECT SUM(amount) FROM transactions WHERE to_wallet_id = p_wallet_id AND type = 'transfer'), 0)
    - COALESCE((SELECT SUM(amount) FROM transactions WHERE from_wallet_id = p_wallet_id AND type = 'transfer'), 0)
  FROM wallets w
  WHERE w.id = p_wallet_id
$$;
