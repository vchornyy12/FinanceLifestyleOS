-- Migration: 014_name_mappings
-- Description: Two-tier product name dictionary.
--
-- Tier 1: global_retailer_name_mappings
--   Shared, system-managed lookup table for known retailer abbreviations
--   (e.g. Biedronka "JOG" -> "jogurt"). Populated via migrations and admin
--   scripts. Regular users can read but not write.
--
-- Tier 2: receipt_item_name_mappings
--   Per-user learned corrections. When a user fixes a Biedronka abbreviation
--   the corrected mapping is stored here. Subsequent parses for the same user
--   + retailer + raw_name auto-apply the correction without review.
--
-- Resolution order at normalization time:
--   1. receipt_item_name_mappings (user, retailer, raw_name)  -- highest priority
--   2. global_retailer_name_mappings (retailer, raw_pattern)
--   3. rule/dictionary pipeline

-- ============================================================
-- TABLE: global_retailer_name_mappings
-- ============================================================

CREATE TABLE public.global_retailer_name_mappings (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- null retailer = abbreviation applies to all Polish retailers
  retailer              text,
  raw_pattern           text        NOT NULL,
  normalized_name       text        NOT NULL,
  canonical_product_name text,
  brand                 text,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT global_name_mappings_unique UNIQUE (retailer, raw_pattern)
);

-- All authenticated users can read the global dictionary.
-- Writes are restricted to service role (via migration or admin script).
ALTER TABLE public.global_retailer_name_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "global_name_mappings_select"
  ON public.global_retailer_name_mappings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Index for fast pattern lookup during normalization
CREATE INDEX idx_global_name_mappings_retailer_pattern
  ON public.global_retailer_name_mappings (retailer, raw_pattern);

-- Also index with NULL retailer so catch-all lookups work efficiently
CREATE INDEX idx_global_name_mappings_pattern
  ON public.global_retailer_name_mappings (raw_pattern)
  WHERE retailer IS NULL;

-- ============================================================
-- SEED: common Biedronka / Polish grocery abbreviations
-- Keep this list small and high-confidence; expand over time.
-- ============================================================

INSERT INTO public.global_retailer_name_mappings
  (retailer, raw_pattern, normalized_name, canonical_product_name, notes)
VALUES
  ('Biedronka', 'JOG',     'jogurt',           NULL, 'prefix abbreviation'),
  ('Biedronka', 'TRUSK',   'truskawkowy',      NULL, 'flavour suffix'),
  ('Biedronka', 'MOZ',     'mozzarella',       NULL, 'prefix abbreviation'),
  ('Biedronka', 'MLEKO',   'mleko',            NULL, 'exact match'),
  ('Biedronka', 'SER',     'ser',              NULL, 'exact match'),
  ('Biedronka', 'MASLO',   'masło',            NULL, 'diacritic normalisation'),
  ('Biedronka', 'SEREK',   'serek',            NULL, 'exact match'),
  ('Biedronka', 'JOGURT',  'jogurt',           NULL, 'full form — identity'),
  ('Biedronka', 'CHLEB',   'chleb',            NULL, 'exact match'),
  ('Biedronka', 'BULKA',   'bułka',            NULL, 'diacritic normalisation'),
  ('Biedronka', 'KURCZAK', 'kurczak',          NULL, 'exact match'),
  ('Biedronka', 'FILET',   'filet',            NULL, 'exact match'),
  ('Biedronka', 'WODA',    'woda',             NULL, 'exact match'),
  ('Biedronka', 'SOK',     'sok',              NULL, 'exact match'),
  ('Biedronka', 'PIWO',    'piwo',             NULL, 'exact match'),
  ('Biedronka', 'WINO',    'wino',             NULL, 'exact match'),
  ('Biedronka', 'CHIPS',   'chipsy',           NULL, 'variant normalisation'),
  ('Biedronka', 'POMIDOR', 'pomidor',          NULL, 'exact match'),
  ('Biedronka', 'ZIEMN',   'ziemniaki',        NULL, 'prefix abbreviation'),
  ('Biedronka', 'MARCHEW', 'marchew',          NULL, 'exact match'),
  -- Żabka-specific
  ('Żabka',    'KAWA',    'kawa',             NULL, 'exact match'),
  ('Żabka',    'PARAGON', NULL,               NULL, 'receipt header artifact — skip'),
  -- Cross-retailer
  (NULL,        'UHT',     'UHT',              NULL, 'milk processing — keep as suffix'),
  (NULL,        'BIO',     'bio / ekologiczny', NULL, 'organic label'),
  (NULL,        'LIGHT',   'light',            NULL, 'reduced-fat variant');

-- ============================================================
-- TABLE: receipt_item_name_mappings  (per-user learned corrections)
-- ============================================================

CREATE TABLE public.receipt_item_name_mappings (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- null retailer = correction applies regardless of store
  retailer              text,
  raw_name              text        NOT NULL,
  normalized_name       text        NOT NULL,
  canonical_product_name text,
  brand                 text,
  category_id           uuid        REFERENCES public.categories(id) ON DELETE SET NULL,
  confidence            numeric(5,4)
                          CHECK (confidence IS NULL
                                 OR (confidence >= 0 AND confidence <= 1)),
  source                text        NOT NULL
                          CHECK (source IN ('user','ai','openfoodfacts','gs1','rule')),
  usage_count           integer     NOT NULL DEFAULT 1,
  last_used_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_name_mappings_unique UNIQUE (user_id, retailer, raw_name)
);

ALTER TABLE public.receipt_item_name_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_name_mappings_all"
  ON public.receipt_item_name_mappings
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Lookup index: (user, retailer, raw_name) — primary resolution path
CREATE INDEX idx_user_name_mappings_lookup
  ON public.receipt_item_name_mappings (user_id, retailer, raw_name);

-- Lookup without retailer constraint (catch-all user corrections)
CREATE INDEX idx_user_name_mappings_user_raw
  ON public.receipt_item_name_mappings (user_id, raw_name)
  WHERE retailer IS NULL;

-- Category analytics (which products map to which categories for a user)
CREATE INDEX idx_user_name_mappings_category
  ON public.receipt_item_name_mappings (user_id, category_id)
  WHERE category_id IS NOT NULL;
