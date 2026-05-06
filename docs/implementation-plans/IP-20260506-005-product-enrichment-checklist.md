# Product Name Enrichment Implementation Checklist

**Date:** 2026-05-06  
**Feature:** Receipt item product name normalization and enrichment  
**Target:** MVP with Open Food Facts integration, GS1-ready architecture

---

## Setup & Database

- [ ] **Review migrations locally**
  - [ ] Verify 013_receipt_item_enrichment.sql syntax in Supabase dashboard
  - [ ] Verify 014_name_mappings.sql syntax
  - [ ] Confirm backfill queries work (raw_name ← name)
  - [ ] Test down migrations roll back cleanly

- [ ] **Apply migrations to dev/main project**
  - [ ] Run 013_receipt_item_enrichment.sql
  - [ ] Run 014_name_mappings.sql
  - [ ] Verify indices created: `idx_receipt_items_user_raw_name`, etc.
  - [ ] Verify RLS policies in place on global_retailer_name_mappings and receipt_item_name_mappings

- [ ] **Seed validation**
  - [ ] Query global_retailer_name_mappings — expect 25 rows (Biedronka + Żabka + cross-retailer)
  - [ ] Spot-check: `SELECT * FROM global_retailer_name_mappings WHERE raw_pattern = 'JOG'`

---

## Phase 1: Types & Adapters

- [ ] **Create `apps/web/lib/types/receiptItem.ts`**
  - [ ] Export `ReceiptItemWithEnrichment` type with all new fields (raw_name, normalized_name, canonical_product_name, brand, size_value, size_unit, flavor, variant, barcode, gtin, normalization_confidence, enrichment_confidence, normalization_source, enrichment_source, needs_review, user_confirmed, product_fingerprint)
  - [ ] Export `ReceiptItemDisplay` (union type for display compatibility)

- [ ] **Create `apps/web/lib/adapters/receiptItemAdapter.ts`**
  - [ ] `toDisplay(item: ReceiptItemWithEnrichment | LegacyReceiptItem): ReceiptItemDisplay`
  - [ ] Fallback logic: use canonical_product_name if present, else normalized_name, else name

- [ ] **Update `apps/web/lib/ocr/receiptSchema.ts`**
  - [ ] Extend `ReceiptItemSchema` to optionally include raw_name, normalized_name
  - [ ] Keep backward compat: name field still required from OCR

- [ ] **Update `apps/web/lib/supabase/queries/receiptItems.ts`**
  - [ ] Modify `getTopProducts()` to select canonical_product_name
  - [ ] Fallback chain: canonical → normalized → name
  - [ ] Test query works with new columns

---

## Phase 2: Normalization Pipeline

- [ ] **Create `apps/web/lib/normalization/polish.ts`**
  - [ ] Polish character normalization (ą→a, ł→l, ż→z, etc.) helper function
  - [ ] Uppercase/lowercase rules (case folding for matching)

- [ ] **Create `apps/web/lib/normalization/abbreviations.ts`**
  - [ ] Import global_retailer_name_mappings from DB on startup (cache in memory or lazy-load)
  - [ ] Lookup function: `expandAbbreviation(raw: string, retailer?: string): {normalized: string, confidence: number, source: string}`
  - [ ] Two-tier resolution: user mappings first, then global

- [ ] **Create `apps/web/lib/normalization/tokenize.ts`**
  - [ ] Tokenize receipt text (split by spaces, punctuation)
  - [ ] Extract likely product attributes (grams, ml, %, count)
  - [ ] Example: "Ser Żółty 200g TRUSK" → tokens: ["ser", "żółty", "200", "g", "trusk"], attributes: {size_value: 200, size_unit: "g"}

- [ ] **Create `apps/web/lib/normalization/normalize.ts`** (main export)
  - [ ] `normalizeReceiptItem(raw: string, retailer?: string): NormalizationResult`
  - [ ] Pipeline: Polish normalization → tokenization → abbreviation expansion
  - [ ] Output: `{ rawName, normalizedName, attributes: {sizeValue, sizeUnit, flavor, variant}, fingerprint, confidence, source }`
  - [ ] Set `needs_review = true` if confidence < 0.7
  - [ ] **Test:** Unit tests for common Biedronka abbreviations (JOG→jogurt, TRUSK→truskawkowy, etc.)

---

## Phase 3: Enrichment Client

- [ ] **Create `apps/web/lib/enrichment/types.ts`**
  - [ ] `EnrichmentResult` interface: canonical_product_name, brand, quantity, gtin, categories, confidence, source
  - [ ] `ProductEnrichmentProvider` abstract interface: `lookup(barcode?: string, name?: string): Promise<EnrichmentResult>`

- [ ] **Create `apps/web/lib/enrichment/openFoodFacts.ts`**
  - [ ] Implement OpenFoodFactsProvider
  - [ ] Method: try barcode lookup first (if available)
  - [ ] Fallback: text search by normalized name (rate-limited: max 1 req/sec per user)
  - [ ] Cache results in memory (LRU cache, size 500)
  - [ ] Map API response → internal fields (canonical_product_name, brand, gtin)
  - [ ] Set enrichment_confidence based on OFF match_score
  - [ ] Handle timeouts gracefully (fail open: return null, don't block save)
  - [ ] **Test:** Mock Open Food Facts responses, verify cache behavior

- [ ] **Create `apps/web/lib/enrichment/gs1.ts`**
  - [ ] Stub GS1Provider implementation (behind env var check)
  - [ ] Placeholder: `async lookup() { return null; }` with TODO comment
  - [ ] Note: awaits GS1 Polska API credentials

- [ ] **Create `apps/web/lib/enrichment/factory.ts`**
  - [ ] `getEnrichmentProvider(backend: 'openfoodfacts' | 'gs1' | 'none'): ProductEnrichmentProvider`
  - [ ] Respect env var: `NEXT_PUBLIC_ENRICHMENT_BACKEND` (default: 'openfoodfacts')

---

## Phase 4: Wire into Receipt Save Flow

- [ ] **Modify `apps/web/app/api/receipts/parse/route.ts`**
  - [ ] Import normalization & enrichment modules
  - [ ] After Claude returns ParsedReceipt, iterate items:
    - [ ] Call `normalizeReceiptItem(item.name, store)` → get normalized fields
    - [ ] If barcode available: call `enrichmentProvider.lookup(barcode)` (async, optional)
    - [ ] Populate DB fields: raw_name, normalized_name, canonical_product_name, brand, gtin, etc.
    - [ ] Set needs_review = true if low confidence
  - [ ] Before returning to client, include all new fields in response
  - [ ] Log enrichment errors but don't fail the request

- [ ] **Update `apps/web/lib/actions/transactions.ts`** (or receipt save action)
  - [ ] When saving receipt items, build insert payload with normalized + enrichment fields
  - [ ] Also insert user correction into receipt_item_name_mappings if user_confirmed=true

- [ ] **Test the flow end-to-end**
  - [ ] Upload a test receipt with abbreviations (e.g., Biedronka with "JOG")
  - [ ] Verify raw_name="JOG", normalized_name="jogurt", normalization_source="dictionary"
  - [ ] Verify needs_review flag set appropriately

---

## Phase 5: Review UI

- [ ] **Update mobile review screen** (`apps/mobile/app/(review)/page.tsx` or equivalent)
  - [ ] Display raw_name (what was scanned)
  - [ ] Display normalized_name (AI suggestion)
  - [ ] Show confidence badges (high/medium/low)
  - [ ] Allow user to edit → confirm correction
  - [ ] On confirm: set user_confirmed=true, insert into receipt_item_name_mappings with source='user'

- [ ] **Update web review screen** (if exists)
  - [ ] Same as mobile: show raw, normalized, canonical
  - [ ] Edit → save flow

- [ ] **Test review flow**
  - [ ] User uploads receipt with abbreviation
  - [ ] Review UI shows suggestion
  - [ ] User accepts → stored in mapping
  - [ ] Next upload of same abbreviation auto-applies user's correction

---

## Phase 6: Adapt Existing Code

- [ ] **Update dashboard** (`apps/web/app/dashboard/page.tsx`)
  - [ ] Modify `getTopProducts()` call to use adapter when rendering
  - [ ] Test "Top Products This Month" section shows canonical names where available

- [ ] **Update chat system prompt** (already done in earlier commit)
  - [ ] Verify topProducts data flows through to buildSystemPrompt

- [ ] **Update mobile dashboard** (Expo version)
  - [ ] Apply same adapter logic for receipt item display

- [ ] **Test backward compatibility**
  - [ ] Query old receipt_items rows (pre-enrichment)
  - [ ] Verify adapter handles null normalized_name gracefully
  - [ ] UI renders without errors

---

## Validation & Testing

- [ ] **Type check**
  - [ ] `pnpm --filter web exec tsc --noEmit` — no errors
  - [ ] `pnpm --filter mobile exec tsc --noEmit` — no errors

- [ ] **Unit tests**
  - [ ] `lib/normalization/normalize.test.ts` — 10+ test cases (JOG→jogurt, MLEKO, ZIEMN→ziemniaki, etc.)
  - [ ] `lib/normalization/tokenize.test.ts` — extract size/unit, flavor, variant
  - [ ] `lib/enrichment/openFoodFacts.test.ts` — mock API, test caching, timeout handling
  - [ ] `lib/adapters/receiptItemAdapter.test.ts` — fallback chain works

- [ ] **Integration test**
  - [ ] Upload Biedronka receipt with 3–5 abbreviations
  - [ ] Verify normalization applied to all items
  - [ ] Verify review UI shows suggestions
  - [ ] Accept one correction → verify stored in mapping

- [ ] **E2E test (Playwright)**
  - [ ] Test full flow: upload → review → save → see product in dashboard

- [ ] **Manual smoke test**
  - [ ] Mobile app: capture receipt, review, save
  - [ ] Web: dashboard shows top products with normalized names
  - [ ] Chat: ask "What am I spending most on?" — uses enriched data

---

## Post-MVP (Not in scope yet)

- [ ] GS1 integration (awaits API credentials)
- [ ] Bulk re-enrich historical receipts
- [ ] Admin UI to manage global_retailer_name_mappings
- [ ] Analytics dashboard: SKU-level spending trends
- [ ] Machine learning: predict product category from raw name + store
- [ ] Expand global dictionary (Żabka, Lidl, Kaufland abbreviations)

---

## Known Gaps / TODOs

- [ ] **Open Food Facts rate limiting:** Currently in-memory. If load increases, move to Redis.
- [ ] **GS1 stub:** Provider interface ready, but NEXT_PUBLIC_GS1_API_KEY + endpoint not configured.
- [ ] **Barcode extraction from OCR:** Claude doesn't extract barcodes yet; future enhancement.
- [ ] **Diacritic handling:** Polish characters normalized but not all edge cases tested (ń vs n).
- [ ] **Retailer context:** OCR returns store name but mobile may not pass it; ensure backward compat.

---

## Rollout Strategy

1. **Migrate DB** (no app change needed yet)
2. **Deploy Phase 1–2** (types, normalization) — no user-facing change
3. **Deploy Phase 3–4** (enrichment + save flow) — enabled behind feature flag
4. **QA in dev environment** — test end-to-end
5. **Deploy Phase 5–6** (UI + adapters) — flag off by default
6. **Gradual rollout:** Flag=true for 10% users → 50% → 100%
7. **Monitor:** Check needs_review counts, enrichment API errors, user corrections in mapping table

---

**Last Updated:** 2026-05-06  
**Owner:** Engineering Team  
**Status:** Ready for Phase 1
