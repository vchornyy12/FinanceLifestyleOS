-- 012_receipt_items.sql
-- Stores individual line items extracted from OCR-parsed receipts.
-- Each row belongs to a parent transactions row (the receipt total).

CREATE TABLE public.receipt_items (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid          NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id        uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text          NOT NULL,
  quantity       numeric(10,3) NOT NULL DEFAULT 1,
  unit_price     numeric(14,2) NOT NULL,
  total_price    numeric(14,2) NOT NULL,
  category_id    uuid          REFERENCES public.categories(id) ON DELETE SET NULL,
  confidence     text          NOT NULL DEFAULT 'high' CHECK (confidence IN ('high', 'low')),
  created_at     timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own receipt items"
  ON public.receipt_items
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Analytics: group by product name for a user
CREATE INDEX idx_receipt_items_user_name
  ON public.receipt_items (user_id, name);

-- Analytics: group by category for a user
CREATE INDEX idx_receipt_items_user_category
  ON public.receipt_items (user_id, category_id);

-- Cascade-aware lookup from parent transaction
CREATE INDEX idx_receipt_items_transaction
  ON public.receipt_items (transaction_id);
