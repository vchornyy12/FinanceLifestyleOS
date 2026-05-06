-- 013_receipt_item_enrichment_down.sql

DROP INDEX IF EXISTS idx_receipt_items_needs_review;
DROP INDEX IF EXISTS idx_receipt_items_gtin;
DROP INDEX IF EXISTS idx_receipt_items_barcode;
DROP INDEX IF EXISTS idx_receipt_items_fingerprint;
DROP INDEX IF EXISTS idx_receipt_items_user_canonical_name;
DROP INDEX IF EXISTS idx_receipt_items_user_normalized_name;
DROP INDEX IF EXISTS idx_receipt_items_user_raw_name;

ALTER TABLE public.receipt_items
  DROP COLUMN IF EXISTS normalization_meta,
  DROP COLUMN IF EXISTS raw_name_tokens,
  DROP COLUMN IF EXISTS product_fingerprint,
  DROP COLUMN IF EXISTS user_confirmed,
  DROP COLUMN IF EXISTS needs_review,
  DROP COLUMN IF EXISTS enrichment_source,
  DROP COLUMN IF EXISTS normalization_source,
  DROP COLUMN IF EXISTS enrichment_confidence,
  DROP COLUMN IF EXISTS normalization_confidence,
  DROP COLUMN IF EXISTS gtin,
  DROP COLUMN IF EXISTS barcode,
  DROP COLUMN IF EXISTS variant,
  DROP COLUMN IF EXISTS flavor,
  DROP COLUMN IF EXISTS size_unit,
  DROP COLUMN IF EXISTS size_value,
  DROP COLUMN IF EXISTS brand,
  DROP COLUMN IF EXISTS canonical_product_name,
  DROP COLUMN IF EXISTS normalized_name,
  DROP COLUMN IF EXISTS raw_name;
