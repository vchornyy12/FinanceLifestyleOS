-- 016_category_learning.sql
-- Tiered category lookup and weighted learning RPCs for receipt items.

-- 1. pg_trgm for fuzzy name matching (Tier 4 fallback)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GiST index for fast similarity search on per-user name mappings
CREATE INDEX idx_user_name_mappings_normalized_trgm
  ON public.receipt_item_name_mappings
  USING GIST (normalized_name gist_trgm_ops)
  WHERE normalized_name IS NOT NULL;

-- 3. lookup_category_from_history
CREATE OR REPLACE FUNCTION public.lookup_category_from_history(
  p_user_id         uuid,
  p_raw_name        text,
  p_normalized_name text,
  p_retailer        text DEFAULT NULL
)
RETURNS TABLE (category_id uuid, confidence numeric, tier int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service-role (background function): auth.uid() is NULL for service-role.
  -- Reject authenticated clients that pass a different user's ID.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT sub.category_id, sub.confidence, sub.tier
  FROM (
    SELECT m.category_id, m.confidence, 1 AS tier
    FROM public.receipt_item_name_mappings m
    WHERE m.user_id = p_user_id
      AND m.raw_name = upper(p_raw_name)
      AND m.retailer IS NOT DISTINCT FROM p_retailer
      AND m.category_id IS NOT NULL

    UNION ALL

    SELECT m.category_id, m.confidence, 2 AS tier
    FROM public.receipt_item_name_mappings m
    WHERE m.user_id = p_user_id
      AND m.raw_name = upper(p_raw_name)
      AND m.category_id IS NOT NULL

    UNION ALL

    SELECT m.category_id, m.confidence, 3 AS tier
    FROM public.receipt_item_name_mappings m
    WHERE m.user_id = p_user_id
      AND p_normalized_name IS NOT NULL
      AND m.normalized_name = p_normalized_name
      AND m.category_id IS NOT NULL

    UNION ALL

    SELECT m.category_id,
           m.confidence * similarity(m.normalized_name, p_normalized_name) AS confidence,
           4 AS tier
    FROM public.receipt_item_name_mappings m
    WHERE m.user_id = p_user_id
      AND m.category_id IS NOT NULL
      AND p_normalized_name IS NOT NULL
      AND m.normalized_name IS NOT NULL
      AND similarity(m.normalized_name, p_normalized_name) > 0.65
  ) sub
  ORDER BY sub.tier ASC, sub.confidence DESC NULLS LAST
  LIMIT 1;
END;
$$;

-- 4. upsert_category_learning
CREATE OR REPLACE FUNCTION public.upsert_category_learning(
  p_user_id         uuid,
  p_raw_name        text,
  p_normalized_name text,
  p_retailer        text,
  p_category_id     uuid,
  p_is_correction   boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service-role (background function): auth.uid() is NULL for service-role.
  -- Reject authenticated clients that pass a different user's ID.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.receipt_item_name_mappings
    (user_id, raw_name, normalized_name, retailer, category_id, confidence, source, usage_count)
  VALUES (
    p_user_id,
    upper(p_raw_name),
    COALESCE(p_normalized_name, upper(p_raw_name)),
    p_retailer,
    p_category_id,
    CASE WHEN p_is_correction THEN 1.0 ELSE 0.6 END,
    CASE WHEN p_is_correction THEN 'user' ELSE 'ai' END,
    1
  )
  ON CONFLICT (user_id, retailer, raw_name) DO UPDATE
    SET category_id  = p_category_id,
        confidence   = CASE
                         WHEN p_is_correction THEN 1.0
                         ELSE LEAST(receipt_item_name_mappings.confidence + 0.05, 0.95)
                       END,
        source       = CASE
                         WHEN p_is_correction THEN 'user'
                         ELSE receipt_item_name_mappings.source
                       END,
        usage_count  = receipt_item_name_mappings.usage_count + 1,
        last_used_at = now(),
        updated_at   = now();
END;
$$;

-- 5. Explicit grants — restrict execution to authenticated users and service_role only
REVOKE EXECUTE ON FUNCTION public.lookup_category_from_history(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_category_learning(uuid, text, text, text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_category_from_history(uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_category_learning(uuid, text, text, text, uuid, boolean) TO authenticated, service_role;
