-- Migration: 013_receipt_item_enrichment
-- Description: Extend receipt_items with normalization and enrichment columns.
--
-- Design decisions:
--   - `name` is kept as-is (backward compat); `raw_name` is the canonical
--     "exact OCR output" field going forward. Both hold the same value for
--     new rows; historical rows are backfilled below.
--   - All new columns are nullable so the migration is safe to apply before
--     any application code starts writing them.
--   - `raw_name` is made NOT NULL only after the backfill.
--   - Confidence values are stored as numeric(5,4) — range 0.0000 to 1.0000.

-- ============================================================
-- 1. Add normalization columns
-- ============================================================

ALTER TABLE public.receipt_items
  ADD COLUMN raw_name                text,
  ADD COLUMN normalized_name         text,
  ADD COLUMN canonical_product_name  text,
  ADD COLUMN brand                   text,
  ADD COLUMN size_value              numeric,
  ADD COLUMN size_unit               text,
  ADD COLUMN flavor                  text,
  ADD COLUMN variant                 text,
  ADD COLUMN barcode                 text,
  ADD COLUMN gtin                    text,
  ADD COLUMN normalization_confidence numeric(5,4)
                                       CHECK (normalization_confidence IS NULL
                                              OR (normalization_confidence >= 0
                                                  AND normalization_confidence <= 1)),
  ADD COLUMN enrichment_confidence   numeric(5,4)
                                       CHECK (enrichment_confidence IS NULL
                                              OR (enrichment_confidence >= 0
                                                  AND enrichment_confidence <= 1)),
  ADD COLUMN normalization_source    text
                                       CHECK (normalization_source IS NULL
                                              OR normalization_source IN (
                                                'ocr','rule','dictionary',
                                                'ai','openfoodfacts','gs1','user'
                                              )),
  ADD COLUMN enrichment_source       text
                                       CHECK (enrichment_source IS NULL
                                              OR enrichment_source IN (
                                                'openfoodfacts','gs1','manual','none'
                                              )),
  ADD COLUMN needs_review            boolean NOT NULL DEFAULT false,
  ADD COLUMN user_confirmed          boolean NOT NULL DEFAULT false,
  ADD COLUMN product_fingerprint     text,
  ADD COLUMN raw_name_tokens         jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN normalization_meta      jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================
-- 2. Backfill raw_name from existing name column
--    Historical rows: normalization_source='ocr', confidence=null (unknown).
--    needs_review stays false — they were already reviewed when entered.
-- ============================================================

UPDATE public.receipt_items
SET raw_name             = name,
    normalization_source = 'ocr'
WHERE raw_name IS NULL;

-- ============================================================
-- 3. Enforce NOT NULL on raw_name now that backfill is done
-- ============================================================

ALTER TABLE public.receipt_items
  ALTER COLUMN raw_name SET NOT NULL;

-- ============================================================
-- 4. Indexes
-- ============================================================

-- raw_name lookups (dictionary matching, dedup analytics)
CREATE INDEX idx_receipt_items_user_raw_name
  ON public.receipt_items (user_id, raw_name);

-- normalized/canonical name lookups (SKU analytics)
CREATE INDEX idx_receipt_items_user_normalized_name
  ON public.receipt_items (user_id, normalized_name)
  WHERE normalized_name IS NOT NULL;

CREATE INDEX idx_receipt_items_user_canonical_name
  ON public.receipt_items (user_id, canonical_product_name)
  WHERE canonical_product_name IS NOT NULL;

-- product fingerprint (dedup, merge)
CREATE INDEX idx_receipt_items_fingerprint
  ON public.receipt_items (product_fingerprint)
  WHERE product_fingerprint IS NOT NULL;

-- barcode / GTIN (Open Food Facts / GS1 lookup cache)
CREATE INDEX idx_receipt_items_barcode
  ON public.receipt_items (barcode)
  WHERE barcode IS NOT NULL;

CREATE INDEX idx_receipt_items_gtin
  ON public.receipt_items (gtin)
  WHERE gtin IS NOT NULL;

-- review queue: quickly fetch items a user still needs to confirm
CREATE INDEX idx_receipt_items_needs_review
  ON public.receipt_items (user_id, needs_review)
  WHERE needs_review = true;
