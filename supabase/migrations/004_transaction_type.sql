-- Migration: 004_transaction_type
-- Description: Add transaction_type enum (expense | income | transfer),
-- transfer endpoint columns, and positive-amount/transfer-integrity CHECKs.
-- Backfills existing rows as 'expense'.

-- ============================================================
-- 1. Enum for the three transaction types
-- ============================================================
CREATE TYPE public.transaction_type AS ENUM ('expense', 'income', 'transfer');

-- ============================================================
-- 2. Type column, backfilled to 'expense' for existing rows.
--    DEFAULT is then dropped so future inserts must be explicit.
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN type public.transaction_type NOT NULL DEFAULT 'expense';

ALTER TABLE public.transactions
  ALTER COLUMN type DROP DEFAULT;

-- ============================================================
-- 3. Transfer endpoint columns (free-text until accounts table
--    lands in Phase 4; strings become FKs at that point).
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN from_account TEXT,
  ADD COLUMN to_account   TEXT;

-- ============================================================
-- 4. Data-integrity constraints
-- ============================================================

-- Amounts are always stored positive; sign is implied by `type`.
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0);

-- Transfers must have both endpoints; non-transfers must have neither.
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transfer_endpoints CHECK (
    (type = 'transfer' AND from_account IS NOT NULL AND to_account IS NOT NULL)
    OR
    (type <> 'transfer' AND from_account IS NULL AND to_account IS NULL)
  );

-- ============================================================
-- 5. Composite index to speed up type-filtered aggregates
--    used by the dashboard monthly-metrics query.
-- ============================================================
CREATE INDEX idx_transactions_user_type_date
  ON public.transactions (user_id, type, date DESC);
