CREATE TYPE public.wallet_type AS ENUM (
  'cash', 'debit', 'credit_card', 'savings', 'investment', 'crypto'
);

CREATE TABLE public.wallets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            public.wallet_type NOT NULL,
  currency        text NOT NULL DEFAULT 'PLN',
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  credit_limit    numeric(14,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallets_credit_limit_check CHECK (
    (type = 'credit_card' AND credit_limit IS NOT NULL AND credit_limit > 0)
    OR
    (type <> 'credit_card' AND credit_limit IS NULL)
  )
);

CREATE INDEX idx_wallets_user_id ON public.wallets(user_id);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallets_own" ON public.wallets
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
