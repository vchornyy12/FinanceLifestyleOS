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
