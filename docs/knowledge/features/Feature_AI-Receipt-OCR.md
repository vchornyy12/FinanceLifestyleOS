# Feature Request Document

## Document Information
- **Feature Request ID**: FR-2026-001
- **Title**: AI Receipt Line-Item Extraction (OCR)
- **Submitted By**: Product / Founder
- **Submitted Date**: 2026-03-31
- **Status**: Approved
- **Priority**: P0-Critical
- **Target Release**: Phase 2 — AI Magic
- **Related Documents**:
  - PRD: `docs/PRD_Finance-Lifestyle-OS.md`, Section 4.1 Feature 1
  - User Story: `docs/knowledge/stories/UserStories_Finance-Lifestyle-OS.md` — US-011
  - Upstream Story: US-010 (Receipt Photo Capture)
  - Downstream Story: US-012 (Review and Correct Parsed Receipt)

---

## Document Status Tracking

| Status | Date | Notes |
|--------|------|-------|
| Submitted | 2026-03-31 | Derived from PRD Phase 2 requirements |
| Approved | 2026-03-31 | Core Phase 2 feature; no approval blocker |
| Added to PRD | 2026-03-31 | PRD Section 4.1, Feature 1 |
| In Development | TBD | Sprint 5 (target) |

---

## 1. Feature Request Overview

### 1.1 Executive Summary

Finance Lifestyle OS eliminates financial tracking friction by automating data entry. The single highest-value automation is receipt parsing: a user photographs a receipt and the system extracts every line item — product name, quantity, unit price — automatically. This feature uses Claude 3.5 Sonnet's vision capabilities via a Supabase Edge Function to parse Polish-language receipts from major retailers (Biedronka, Żabka, Lidl, Kaufland) and return structured JSON ready for user review and storage.

### 1.2 Problem Statement

**Current Situation**:
Without this feature, users must manually type each product, price, and quantity from every receipt. A typical Biedronka grocery receipt has 10–20 line items. Entering all of them takes 3–5 minutes and requires the user to still have the receipt in hand.

**Impact of Problem**:
- **Business impact**: Manual entry is the primary cause of app abandonment in personal finance apps. Without automation, the product cannot deliver on its core promise of "minimum effort, maximum insight."
- **User impact**: Users either skip logging receipts (data gaps, useless analytics) or burn out after a few days (churn). Neither outcome is acceptable for a product built around financial awareness.
- **Frequency**: Every grocery purchase — typically 2–5 per week for the primary persona
- **Severity**: Critical — this is the product's primary differentiator vs. competitors

**Who is Affected**:
- All users who make grocery or retail purchases (100% of user base)
- Primary persona: Marta (busy professional, 32, Warsaw) — loses receipts before logging; won't type 15 items
- Secondary persona: Kasia (parent tracking household spend) — needs item-level data to spot price changes

### 1.3 Proposed Solution (High-Level)

When a user submits a receipt image (from US-010), a Supabase Edge Function receives the image, calls the Anthropic API (Claude 3.5 Sonnet with vision), and returns a structured JSON payload containing: store name, date, and an array of line items (product name, quantity, unit price, subtotal, auto-assigned category). Results are displayed on a review screen (US-012) where the user confirms or corrects before saving.

### 1.4 Expected Outcomes

**Success looks like**:
- A user photographs a 15-item Biedronka receipt and sees all 15 items correctly extracted within 10 seconds
- Items are correctly categorized so the user only needs to review, not re-enter
- Low-confidence extractions are flagged rather than silently wrong

**Success Metrics**:
- **Line-item accuracy**: ≥ 90% on test set of 100 real Polish receipts (happy path)
- **End-to-end latency**: ≤ 10 seconds from image upload to review screen rendered
- **User correction rate**: < 15% of items corrected after parsing (proxy for quality)
- **Feature adoption**: ≥ 70% of Phase 2 beta users use OCR as their primary entry method within 2 weeks of launch

---

## 2. Requirements Clarification

### 2.1 Detailed Requirements

**Functional Requirements**:

1. **FR-001 — Image Ingestion**
   - User need: Receipt image captured in US-010 (camera or gallery) must be reliably delivered to the parsing pipeline
   - Must-have
   - Acceptance criteria: Image is uploaded to Supabase Storage (private bucket) and a signed URL is passed to the Edge Function; original file is never exposed publicly

2. **FR-002 — Structured Line-Item Extraction**
   - User need: Every product on the receipt must be extracted as a discrete record, not as a block of text
   - Must-have
   - Acceptance criteria: Each item extracted as `{name, quantity, unit_price, total_price}` with no line items merged or split incorrectly

3. **FR-003 — Store Metadata Extraction**
   - User need: Store name and purchase date must be captured automatically (no manual entry)
   - Must-have
   - Acceptance criteria: Store name and date parsed correctly in ≥ 95% of clearly legible receipts

4. **FR-004 — Automatic Category Mapping**
   - User need: Each item should be assigned a category so the user isn't forced to categorize every product individually
   - Must-have
   - Acceptance criteria: ≥ 85% of items receive a correct category assignment; mappings respect the app's existing category taxonomy

5. **FR-005 — Confidence Flagging**
   - User need: When the AI is uncertain about a value, the user must be informed rather than presented with a silent error
   - Must-have
   - Acceptance criteria: Items with low parsing confidence are marked with a warning indicator in the review UI; no silent data corruption

6. **FR-006 — Polish Language Support**
   - User need: Polish product names, abbreviations, and receipt formats must be recognized correctly
   - Must-have
   - Acceptance criteria: Polish-language receipts from the top 5 Polish retailers (Biedronka, Żabka, Lidl, Kaufland, Carrefour) parse with ≥ 90% item-level accuracy

7. **FR-007 — Total Validation**
   - User need: User should be warned if extracted item totals don't add up to the receipt total (signals missing/misread items)
   - Should-have
   - Acceptance criteria: Extracted subtotal sum is compared to receipt total; discrepancy > 1 PLN triggers a warning shown in the review screen

**Non-Functional Requirements**:
- **Performance**: End-to-end (upload → results displayed) ≤ 10 seconds at P90; P99 ≤ 20 seconds
- **Scalability**: Edge Function must handle concurrent parsing requests without queuing delay for up to 100 simultaneous users (Phase 2 beta scale)
- **Security**: Anthropic API key stored as Edge Function secret; receipt images in private Supabase Storage; RLS ensures users only access their own receipts
- **Reliability**: Parsing failures must be handled gracefully — never result in data loss or silent wrong data; user must always be able to fall back to manual entry
- **Cost control**: Each parsing request must be a single Anthropic API call; no retry loops that multiply cost

### 2.2 User Stories

**Epic**: EPIC-004 — AI Receipt OCR

**User Story (US-011 — primary)**:
```
As a user who has photographed a receipt
I want the app to automatically extract every product, price, and quantity
So that I don't have to type out each line item manually

Acceptance Criteria:
- [ ] Given a clear photo of a Biedronka receipt with 10 line items,
      when parsing completes,
      then all 10 products are shown with correct names, quantities, and prices
- [ ] Given I submit a receipt photo,
      when extraction is in progress,
      then I see a loading indicator
      and results are presented within 10 seconds
- [ ] Given a line item "Chleb Żytni 500g" is extracted,
      when extraction completes,
      then the item is automatically assigned to the "Groceries/Bread" category
- [ ] Given a line item is partially illegible,
      when extraction completes,
      then the item is shown with a yellow warning icon
      and note: "We're not sure about this item — please review"
- [ ] Given a receipt with Polish product names,
      when extracted,
      then product names are preserved in Polish and correctly categorized
```

**Dependent Story (US-010 — upstream)**:
```
As a mobile user
I want to photograph a receipt directly from the app
So that I can start the automatic parsing process

Acceptance Criteria:
- [ ] User can open camera or select from gallery
- [ ] Photo confirmed by user before submission
- [ ] Image compressed to < 2MB before upload
```

**Dependent Story (US-012 — downstream)**:
```
As a user reviewing a parsed receipt
I want to correct any errors before saving
So that my financial data is accurate

Acceptance Criteria:
- [ ] User can edit any line item (name, price, quantity, category)
- [ ] User can delete incorrect items
- [ ] User can add missing items manually
- [ ] Confirming saves all items as individual transactions in Supabase
```

### 2.3 User Flows

**Primary Flow — Happy Path**:
1. User photographs receipt (US-010 camera flow)
2. User taps "Use this photo" — image compressed and uploaded to Supabase Storage
3. App calls `POST /functions/v1/parse-receipt` Edge Function with image path
4. Loading screen shown with animated indicator: "Reading your receipt…"
5. Edge Function downloads image from Storage, encodes to base64, calls Anthropic API
6. Anthropic returns structured JSON within ~5 seconds
7. Edge Function validates and normalizes JSON, returns to client
8. Review screen renders: store name, date, list of items with categories
9. User reviews (typically 20–30 seconds), makes 0–2 corrections
10. User taps "Save Receipt" → all items saved as transactions → home screen with "Receipt saved!" toast

**Alternative Flows**:
- **Flow A (Gallery upload)**: User selects image from gallery instead of camera → same pipeline from step 2
- **Flow B (Digital receipt screenshot)**: User uploads Żabka/Biedronka app screenshot → same pipeline; Claude adapts to digital receipt format

**Error Flows**:
- **Error 1 — Network failure during upload**: Retry upload up to 2 times with exponential backoff; if all fail, show: "Upload failed. Check your connection and try again." Receipt data is not lost.
- **Error 2 — Anthropic API error (5xx or timeout)**: Show: "We couldn't read this receipt right now. You can try again or enter items manually." Do not retry automatically (cost protection).
- **Error 3 — Anthropic returns unparseable/malformed JSON**: Edge Function catches JSON parse error; return error code `PARSE_FAILED`; client prompts manual entry.
- **Error 4 — Image too dark / completely illegible**: Claude will typically return 0 items or very low confidence; Edge Function returns `confidence: "low"` flag; client shows: "This receipt was hard to read — you may want to retake the photo or enter manually."

### 2.4 Edge Cases and Special Scenarios

| Scenario | Description | Expected Behavior |
|----------|-------------|-------------------|
| Receipt with loyalty card charges | Loyalty discount line (e.g., "Moja Biedronka -2.50 PLN") | Extract as negative-value line item; category: "Discount" |
| Multi-page receipt | Very long receipt photographed in two images | Phase 2 scope: single-image only; UI shows "For best results, ensure the full receipt fits in one photo" |
| Receipt with VAT breakdown | Polish receipts show VAT categories (A, B, C) at bottom | Extract product lines only; ignore VAT summary block |
| Handwritten price correction | Store employee manually crossed out a price | Extract the visible printed price; flag item as low-confidence |
| Foreign-language receipt (German Lidl) | Lidl receipts sometimes mix DE and PL | Extract what is parseable; Polish product names take precedence |
| Duplicate receipt submission | User submits same receipt twice | Duplicate detection in US-012 review flow; flag if same store/date/total already exists |
| Image file > 2MB | User selects a very high-res photo | Compress to < 2MB client-side (expo-image-manipulator) before upload |
| Zero-item extraction | Completely illegible or wrong image type | Return error with code `NO_ITEMS_FOUND`; prompt retry or manual entry |
| Discount coupons / promotional items | Free items (price = 0.00) | Extract with price 0.00; include in list so inventory is complete |
| Receipt total doesn't match sum of items | Rounding or missing item | Flag discrepancy in review screen if > 1 PLN difference |

### 2.5 Assumptions

- Claude 3.5 Sonnet's vision model can reliably read Polish retail receipts including common abbreviations (e.g., "Chust. odc." = "Chusteczki odchodkowe")
- Receipt images will be ≤ 2MB after client-side compression (standard grocery receipt photos are 200–800KB at reasonable quality)
- The app's category taxonomy is pre-populated with at least 20 categories covering standard Polish grocery/retail items before this feature launches
- Users are primarily on iOS or modern Android (camera quality sufficient for clear receipt photos)
- The Anthropic API remains available with < 1% downtime during Phase 2 beta

### 2.6 Open Questions

- [ ] **Prompt engineering**: What is the optimal system prompt for Polish receipt extraction? — Assigned to: Engineering — Due: Sprint 4 (pre-development spike)
- [ ] **Category taxonomy**: Should the AI use a closed list of categories (mapped in the prompt) or open-ended labels normalized post-extraction? — Assigned to: Product — Due: Sprint 4
- [ ] **Image storage retention**: How long should raw receipt images be stored in Supabase Storage after parsing? 30 days? Indefinitely? GDPR implications? — Assigned to: Product/Legal — Due: Sprint 5
- [ ] **Offline parsing**: Should receipt parsing be queued for when connectivity is restored (complex), or should parsing require connectivity (simpler, Phase 2 scope)? — Decision: Phase 2 requires connectivity for parsing; offline mode (US-009) queues the image for parsing when online
- [ ] **Multi-receipt batching**: Should users be able to upload multiple receipts at once? — Decision: Out of scope for Phase 2; single receipt at a time

---

## 3. Technical Analysis

### 3.1 Technical Feasibility

**Complexity Assessment**: Complex

**Technical Challenges**:

1. **Polish retail receipt variability**: Receipt formats differ significantly between Biedronka, Żabka, Lidl, and Kaufland — layout, abbreviations, fonts, and encoding all vary. Claude must generalize across formats without explicit format detection.
   - Mitigation: Build a test suite of 50+ real receipt images across retailers before production; tune prompt against failures; target 90% accuracy, not 100%

2. **Structured output reliability**: The parsing pipeline depends on Claude returning valid, schema-conformant JSON every time. Hallucinations or schema deviations will break the client rendering.
   - Mitigation: Use Claude's structured output / JSON mode; implement strict schema validation in the Edge Function; return a normalized error payload on any JSON anomaly

3. **End-to-end latency budget**: The 10-second target spans: image upload (1–3s on mobile data) + Edge Function invocation (200ms) + Anthropic API response (4–7s typical for vision) + client rendering (< 200ms). This is tight.
   - Mitigation: Pre-upload image in the background as soon as user confirms photo (before they tap "parse"); show loading indicator immediately; monitor P90 latency in production

4. **API cost at scale**: At $0.003 per image (estimated for Claude 3.5 Sonnet vision with ~1500 token response), 1000 monthly users parsing 8 receipts/month = ~$24/month. Acceptable at Phase 2; must plan for growth.
   - Mitigation: Track per-user parsing volume; implement soft rate limits (max 50 parses/user/month in Phase 2 beta) to prevent abuse

**Technical Risks**:

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Claude accuracy < 90% on Polish receipts | Medium | High | Spike with real receipts before Sprint 5; build correction UI that captures corrections as training signal |
| Anthropic API latency > 10s consistently | Low | High | Monitor in staging; implement progress feedback to reduce perceived latency; set 15s timeout |
| Supabase Storage upload failure on mobile | Low | Medium | Retry logic with exponential backoff (max 3 attempts); offline queue for image upload |
| JSON schema mismatch breaking client | Medium | High | Validate against Zod schema in Edge Function; return typed error vs. untyped exception |
| Receipt images contain PII beyond purchase data (e.g., loyalty card number) | Medium | Medium | Store images in private bucket; document in privacy policy; add image deletion after configurable retention period |

### 3.2 System Impact Analysis

**Affected Components**:
- **Mobile (React Native / Expo)**: New `ReceiptCaptureScreen` → `ReceiptParsingLoadingScreen` → `ReceiptReviewScreen` flow; `expo-image-picker`, `expo-image-manipulator` for compression; Supabase Storage upload client
- **Web (Next.js)**: Receipt upload flow on web (gallery/file picker only — no camera); reuses same Edge Function
- **Supabase Edge Function (new)**: `parse-receipt` — handles image download, Anthropic API call, JSON normalization, category mapping
- **Database**: New `receipts` table, modified `transactions` table (add `receipt_id` FK, `source` enum), new `receipt_items` table
- **Supabase Storage**: New private bucket `receipts` with per-user path structure (`/receipts/{user_id}/{receipt_id}.jpg`)
- **Category mapping**: New `category_mappings` table or seeded lookup used by Edge Function

**Integration Points**:
- **Anthropic API**: Claude 3.5 Sonnet, Messages API with vision (base64 image in `image` content block)
- **Supabase Storage**: Upload from mobile client; download in Edge Function via signed URL
- **Supabase Auth**: Edge Function must verify JWT to associate receipt with correct user

**Dependencies**:
- **Blockers**: US-010 (Receipt Photo Capture) — image input pipeline must exist; Supabase project provisioned with Storage and Edge Functions enabled
- **Related work**: US-007 (Category Management) — category taxonomy must exist before category mapping can be validated; US-012 (Review UI) must be built in the same sprint
- **Future work**: Enables US-018 (SKU-Level Analytics), US-026 (Health Labeling) — all depend on having itemized data

### 3.3 Data Requirements

**New Data Entities**:

```typescript
// receipts — one record per submitted receipt image
interface Receipt {
  id: string;             // uuid
  user_id: string;        // FK → auth.users
  store_name: string;     // extracted store name
  purchase_date: Date;    // extracted date
  total_amount: number;   // extracted receipt total (PLN)
  image_path: string;     // Supabase Storage path
  parse_status: 'pending' | 'success' | 'partial' | 'failed';
  raw_response: Json;     // full Anthropic API response (for debugging)
  created_at: Date;
}

// receipt_items — one record per extracted line item
interface ReceiptItem {
  id: string;
  receipt_id: string;     // FK → receipts
  user_id: string;        // FK → auth.users (for RLS)
  product_name: string;   // extracted product name (Polish preserved)
  quantity: number;
  unit_price: number;     // PLN
  total_price: number;    // PLN
  category_id: string;    // FK → categories
  confidence: 'high' | 'medium' | 'low';
  user_corrected: boolean; // true if user edited this item in review
  created_at: Date;
}

// transactions — modified to link to receipt items
// Add columns:
//   receipt_item_id uuid REFERENCES receipt_items(id) ON DELETE SET NULL
//   source text CHECK (source IN ('manual', 'ocr', 'bank_import'))
```

**Data Volume Estimates**:
- Phase 2 beta (100 users): 100 × 8 receipts/month × 12 items avg = ~9,600 receipt_items/month
- Storage: 100 × 8 × 500KB avg = ~400MB/month (manageable on Supabase Pro)
- Raw Anthropic responses: ~2KB per receipt = ~1.6MB/month (store in JSONB column, not separate table)

**Data Migration**:
- Migration needed: Yes — add new tables and modify `transactions` table
- Strategy: Non-breaking additive migration; `receipt_item_id` column nullable; `source` column with default `'manual'` for existing records

### 3.4 Security and Privacy

**Security Considerations**:
- **Authentication**: Edge Function validates Supabase JWT from Authorization header; rejects unauthenticated requests with 401
- **Authorization**: RLS on `receipts` and `receipt_items` tables — `user_id = auth.uid()` for all SELECT/INSERT/UPDATE/DELETE
- **API key protection**: `ANTHROPIC_API_KEY` stored as Supabase Edge Function secret (not in code, not in env committed to repo)
- **Storage access**: Receipt images stored in private bucket; only the owning user (via signed URLs) and the Edge Function (via service role key) can access them

**Privacy Considerations**:
- **PII in receipts**: Receipt images may contain loyalty card numbers, payment card last-4 digits, or customer names. These are incidentally captured but not extracted or stored as structured data.
- **Data retention**: Raw receipt images should be deletable — add image deletion to account deletion flow; consider auto-deletion after 90 days (open question)
- **GDPR**: User must be able to request deletion of all receipts and parsed data (include in data deletion endpoint); document that images are processed by Anthropic API in privacy policy
- **User consent**: Privacy policy must disclose that receipt photos are sent to Anthropic for processing; obtain consent at onboarding

### 3.5 Performance Considerations

**Expected Load** (Phase 2 beta):
- Concurrent parsing requests: up to 10 simultaneous (100 users, not all parsing at once)
- Supabase Edge Functions scale automatically; Anthropic API rate limits are the constraint
- Requests per second: < 1 RPS sustained (bursts possible if push notification triggers simultaneous receipt capture by many users)

**Performance Requirements**:
- Upload to Supabase Storage: < 3 seconds on mobile LTE (500KB image)
- Edge Function cold start: < 500ms (Supabase Edge Functions, Deno)
- Anthropic API vision response: target < 7 seconds; reject if > 15 seconds (timeout)
- Client rendering of review screen: < 300ms after response received
- **Total end-to-end P90 target**: ≤ 10 seconds

**Optimization Needs**:
- **Image pre-upload**: Begin upload to Storage immediately after user confirms photo, before tapping "Parse" — reduces perceived latency by 1–3 seconds
- **Streaming response**: Anthropic supports streaming; for Phase 2, non-streaming is simpler and sufficient given the timeout budget
- **Caching**: Do NOT cache parsing results (each receipt is unique); DO cache the category mapping lookup table in-memory in the Edge Function between invocations

---

## 4. Solution Options

### 4.1 Solution Option 1: Claude 3.5 Sonnet via Supabase Edge Function (Recommended)

**Description**:
Mobile client uploads image to Supabase Storage. Client calls a Supabase Edge Function (`parse-receipt`) with the image path. The Edge Function downloads the image, base64-encodes it, calls the Anthropic Messages API with a carefully engineered system prompt requesting structured JSON output, validates the response against a Zod schema, performs category mapping, and returns the normalized result to the client.

**Architecture**:
```
Mobile App
  │
  ├─[1] Upload compressed image → Supabase Storage (private bucket)
  │
  ├─[2] POST /functions/v1/parse-receipt {image_path}
  │       │
  │       └─ Supabase Edge Function (Deno)
  │               │
  │               ├─[3] Download image via signed URL → base64 encode
  │               │
  │               ├─[4] POST https://api.anthropic.com/v1/messages
  │               │       Model: claude-3-5-sonnet-20241022
  │               │       Content: system prompt + base64 image
  │               │       → Structured JSON response
  │               │
  │               ├─[5] Validate JSON (Zod schema)
  │               ├─[6] Map items to categories (lookup table)
  │               ├─[7] Insert receipt + receipt_items to DB
  │               └─[8] Return normalized payload to client
  │
  └─[9] Render ReceiptReviewScreen with extracted items
```

**Implementation Details**:
- **Mobile**: `expo-image-manipulator` for compression; `supabase.storage.upload()` for storage upload; `supabase.functions.invoke('parse-receipt')` for Edge Function call
- **Edge Function (Deno/TypeScript)**:
  ```typescript
  // System prompt (abbreviated)
  const SYSTEM_PROMPT = `
  You are a receipt parser. Extract all line items from the receipt image.
  Return ONLY valid JSON matching this schema:
  {
    "store_name": string,
    "purchase_date": "YYYY-MM-DD",
    "items": [
      {
        "name": string,          // preserve original Polish product name
        "quantity": number,
        "unit_price": number,    // PLN, 2 decimal places
        "total_price": number,   // PLN, 2 decimal places
        "confidence": "high" | "medium" | "low"
      }
    ],
    "receipt_total": number
  }
  For unclear items, set confidence to "low" rather than guessing.
  Do not include VAT summaries, loyalty discounts, or payment method lines as items.
  `;
  ```
- **Database**: Supabase Postgres (existing); new tables via migration
- **Infrastructure**: Supabase Edge Functions (no new infrastructure required)

**Pros**:
- ✅ Best-in-class vision model accuracy for complex, real-world document parsing
- ✅ Handles Polish language, varying receipt layouts, and low-quality images better than rule-based OCR
- ✅ No additional infrastructure — Supabase Edge Functions already in the stack
- ✅ Structured output support (JSON mode) reduces response parsing complexity
- ✅ Single API call per receipt — cost predictable and low at Phase 2 scale
- ✅ Aligns with existing Anthropic API dependency (already planned for AI Financial Coach)

**Cons**:
- ❌ Dependency on external API (Anthropic) — unavailability means OCR is unavailable
- ❌ Per-request cost (estimated ~$0.003–0.005/receipt) — must monitor at scale
- ❌ Latency governed by Anthropic API response time (typically 4–8s for vision) — cannot be reduced below this floor
- ❌ Prompt engineering requires iteration — accuracy won't be 90%+ on day one

**Effort Estimate**:
- Development: 8 developer-days (Edge Function + mobile integration + DB migration + review UI integration)
- Testing: 3 days (test receipt set curation + accuracy measurement + integration tests)
- Deployment: 1 day
- Total: 12 days

**Cost Estimate**:
- Development: Internal (no external cost)
- Infrastructure: $0 additional (Supabase Edge Functions included in Pro plan)
- Anthropic API: ~$5–25/month at 100–500 users parsing 8 receipts/month
- Total ongoing: ~$5–25/month

**Technical Debt**: Low — clean architecture; only risk is prompt engineering needing maintenance as retailer receipt formats evolve.

---

### 4.2 Solution Option 2: Google Vision API (Cloud Vision OCR)

**Description**:
Use Google Cloud Vision API's document text detection to extract raw text from the receipt image, then apply a custom parsing layer (regex/NLP) to structure the text into line items. Deployed as a Supabase Edge Function or a separate Cloud Function.

**Architecture**:
```
Mobile App
  │
  ├─[1] Upload image → Supabase Storage
  ├─[2] Call Edge Function
  │       ├─[3] Call Google Vision API → raw OCR text (JSON)
  │       ├─[4] Custom parser (regex + heuristics) → structured items
  │       └─[5] Return to client
  └─[6] Render review screen
```

**Implementation Details**:
- Requires Google Cloud project, Vision API enabled, service account credentials
- Custom parser must handle: Polish character encoding, varying column layouts (name | qty | price), promotions, discounts
- Requires separate maintenance of parsing rules per retailer

**Pros**:
- ✅ Google Vision OCR is highly accurate for clean text extraction
- ✅ Lower per-request cost (~$0.0015/image vs. ~$0.003–0.005 for Claude)
- ✅ Mature, well-documented API

**Cons**:
- ❌ Requires building and maintaining a custom receipt parsing layer on top of raw OCR text — significant engineering effort and ongoing maintenance burden
- ❌ Rule-based parser will struggle with layout variations between retailers; accuracy likely < 85% out of the box
- ❌ Adds Google Cloud as an additional vendor dependency (new account, credentials management, billing)
- ❌ Does NOT natively understand semantic categories — requires a separate categorization step
- ❌ Higher total development cost due to custom parser (~15 developer-days vs. 8)

**Effort Estimate**:
- Development: 15 developer-days
- Testing: 5 days
- Total: 20 days

**Cost Estimate**:
- Infrastructure: Google Cloud Vision ~$1.50/1000 images
- Additional Cloud Function hosting if not using Supabase Edge Functions
- Total ongoing: ~$1–12/month (lower API cost, but higher dev maintenance cost)

**Technical Debt**: High — custom receipt parser requires ongoing maintenance per retailer format change.

---

### 4.3 Solution Option 3: On-Device OCR (Apple Vision / ML Kit)

**Description**:
Use Apple Vision Framework (iOS) or Google ML Kit (Android) to run OCR entirely on-device, then apply a parsing layer to structure the extracted text. No server round-trip for OCR itself.

**Architecture**:
```
Mobile App
  ├─[1] Capture image
  ├─[2] On-device OCR (Apple Vision / ML Kit) → raw text blocks
  ├─[3] Client-side custom parser → structured items
  └─[4] POST structured items to Supabase → save
```

**Implementation Details**:
- Expo doesn't expose Apple Vision or ML Kit natively; requires a custom native module or a library like `@react-native-ml-kit/text-recognition`
- Still requires a custom parsing layer (same problem as Option 2)
- Results sync to Supabase after local parsing

**Pros**:
- ✅ No API cost per scan
- ✅ Works fully offline (no server round-trip for OCR)
- ✅ Lower latency (no network required for parsing itself)

**Cons**:
- ❌ OCR accuracy varies significantly by device and iOS/Android version
- ❌ Requires custom native module or third-party library with Expo compatibility concerns
- ❌ Same custom parsing layer maintenance problem as Option 2
- ❌ Category mapping still requires server-side call or large on-device lookup table
- ❌ Accuracy significantly lower than Claude for challenging receipts (low light, crumpled paper, small font)
- ❌ Offline parsing was explicitly deferred out of Phase 2 scope — this adds scope without proportional value

**Effort Estimate**:
- Development: 20+ developer-days (native module complexity)
- Testing: 6 days (per-device accuracy testing)
- Total: 26+ days

**Technical Debt**: Very High — native module dependency, per-platform maintenance, parsing rules.

---

### 4.4 Recommendation

**Recommended Solution**: Option 1 — Claude 3.5 Sonnet via Supabase Edge Function

**Rationale**:
1. **Highest accuracy at lowest engineering cost**: Claude's vision capabilities handle layout variability, Polish abbreviations, and challenging image conditions without a custom parsing layer. The 90% accuracy target is realistic for Option 1, not achievable for Options 2 or 3 without significant additional effort.
2. **Minimal new infrastructure**: Option 1 requires zero new vendor accounts or infrastructure — only the Anthropic API, which is already planned for the AI Financial Coach in Phase 4. Options 2 and 3 each introduce a new vendor dependency.
3. **Fastest time to Phase 2**: 12 dev-days vs. 20 (Option 2) vs. 26+ (Option 3). Phase 2 is the product's most important milestone for demonstrating core value.
4. **Strategic coherence**: The product is built around Claude AI as a core differentiator. Using Claude for OCR deepens that investment and creates learnings applicable to the Financial Coach feature.

**Trade-offs Accepted**:
- External API dependency: Acceptable because failure is graceful (user falls back to manual entry); Anthropic SLA is > 99.9% uptime
- Per-request cost (~$0.003–0.005/receipt): Acceptable at Phase 2 scale (<$25/month for 100 users); must revisit at Phase 3+ scale with rate limiting

**Alternative Considered**:
Option 2 (Google Vision) was not chosen because the custom parsing layer it requires is the primary engineering complexity in the problem — raw OCR text extraction is the easy part. Option 3 was not chosen because native module complexity exceeds the benefit and offline parsing is out of Phase 2 scope.

---

## 5. Test Cases and Scenarios

### 5.1 Functional Test Cases

**Test Case 1: Happy Path — Biedronka Receipt**
- **Test ID**: TC-FR-001-001
- **Description**: Verify complete line-item extraction from a clear Biedronka grocery receipt
- **Priority**: P0
- **Preconditions**:
  - User authenticated
  - Test receipt: Biedronka, 2024-02-15, 12 items, total 87.43 PLN
  - Clear, well-lit photograph
- **Test Steps**:
  1. Submit test receipt image to `parse-receipt` Edge Function
  2. Await response (max 10 seconds)
  3. Parse returned JSON
  4. Compare extracted items against ground truth
- **Expected Result**: 12/12 items extracted; store = "Biedronka"; date = 2024-02-15; total = 87.43 PLN; all items have category assigned
- **Test Data**: `test/fixtures/receipts/biedronka_01.jpg` with ground truth `test/fixtures/receipts/biedronka_01_truth.json`

**Test Case 2: Żabka Digital Screenshot**
- **Test ID**: TC-FR-001-002
- **Description**: Verify extraction from a Żabka app digital receipt screenshot
- **Priority**: P0
- **Preconditions**: Digital screenshot from Żabka mobile app (white background, clear text)
- **Test Steps**: Same as TC-001
- **Expected Result**: All items extracted; confidence "high" on all items (digital text is always clear)
- **Test Data**: `test/fixtures/receipts/zabka_screenshot_01.png`

**Test Case 3: Partial Receipt (Top Half Obscured)**
- **Test ID**: TC-FR-001-003
- **Description**: Verify confidence flagging when store header is obscured
- **Priority**: P1
- **Preconditions**: Biedronka receipt with top 30% folded over (store name and date not visible)
- **Test Steps**: Submit partially obscured receipt
- **Expected Result**: Items below fold extracted correctly; store_name = null or empty string; purchase_date = null; at least one item flagged "low" confidence; no crash

**Test Case 4: Anthropic API Timeout**
- **Test ID**: TC-FR-001-004
- **Description**: Verify graceful error handling when Anthropic API exceeds 15-second timeout
- **Priority**: P0
- **Preconditions**: Anthropic API timeout simulated in Edge Function test environment (mock)
- **Test Steps**: Submit any receipt; mock Anthropic to delay 16 seconds
- **Expected Result**: Edge Function returns `{error: "TIMEOUT", message: "..."}` within 16 seconds; client shows manual entry fallback prompt; no data written to DB

**Test Case 5: Invalid JSON Response from Anthropic**
- **Test ID**: TC-FR-001-005
- **Description**: Verify Zod schema validation catches malformed Anthropic response
- **Priority**: P0
- **Preconditions**: Mock Anthropic to return syntactically valid JSON that doesn't match the receipt schema
- **Expected Result**: Edge Function catches Zod validation error; returns `{error: "PARSE_FAILED"}`; client shows fallback prompt

**Test Case 6: Duplicate Receipt Submission**
- **Test ID**: TC-FR-001-006
- **Description**: Verify duplicate detection when same receipt submitted twice
- **Priority**: P1
- **Preconditions**: Receipt already saved with store="Biedronka", date=2024-02-15, total=87.43
- **Test Steps**: Submit identical receipt again
- **Expected Result**: Review screen shows duplicate warning: "This looks like a receipt you've already saved." User can dismiss and save, or cancel.

**Test Case 7: Receipt Total Mismatch**
- **Test ID**: TC-FR-001-007
- **Description**: Verify total mismatch warning when extracted items don't sum to receipt total
- **Priority**: P1
- **Preconditions**: Receipt where one item is partially illegible; extracted items total 84.50 PLN vs. receipt total 87.43 PLN (diff = 2.93 PLN > 1 PLN threshold)
- **Expected Result**: Review screen shows warning banner: "Item totals don't match the receipt total (87.43 PLN). Please check for missing items."

### 5.2 Edge Case Test Scenarios

| Test Scenario | Input/Condition | Expected Behavior | Priority |
|---------------|-----------------|-------------------|----------|
| All-caps product names | Lidl receipt (all caps) | Extracted correctly; normalized to title case in display | P1 |
| Negative price (discount line) | "Rabat Moja Biedronka -3.00" | Extracted as discount item; negative total_price; category "Discount" | P1 |
| Quantity not shown | Single unit, no qty column | quantity = 1 (default) | P1 |
| Decimal comma (Polish format) | "12,99" not "12.99" | Parsed to 12.99 as number | P0 |
| Very long product name | 60+ character name | Extracted in full; no truncation | P2 |
| Emoji / special chars in name | Unlikely; some digital receipts | Pass through safely | P3 |
| Zero-quantity item | Rare edge case | Exclude from results or flag low confidence | P2 |
| Wrong image type (selfie) | User accidentally selects wrong photo | 0 items returned; `NO_ITEMS_FOUND` error; prompt to try again | P0 |
| Image > 2MB (not compressed) | Client compression failed | Edge Function returns 413; client retries with additional compression | P1 |

### 5.3 Performance Test Scenarios

**Load Testing**:
- **Scenario**: 10 concurrent users each submitting a 500KB receipt image simultaneously
- **Expected**: All responses within 10 seconds; no Anthropic API rate limit errors at this scale
- **Tool**: k6 or Artillery with mocked Supabase Storage

**Latency Benchmarking**:
- **Scenario**: 50 sequential receipt parses across 5 different receipt types
- **Measure**: P50, P90, P99 end-to-end latency
- **Target**: P90 ≤ 10s, P99 ≤ 20s

**Cost Measurement**:
- **Scenario**: Parse 100 real receipts; measure actual Anthropic API token usage
- **Target**: ≤ 1500 output tokens per receipt; adjust prompt if exceeded

### 5.4 Security Test Scenarios

| Security Test | Description | Expected Result |
|---------------|-------------|-----------------|
| Unauthenticated Edge Function call | POST to `/functions/v1/parse-receipt` without JWT | 401 Unauthorized returned |
| User A accesses User B's receipt | Query `receipts` table for another user's receipt_id | RLS blocks; 0 rows returned |
| Malicious image (polyglot file) | Submit .jpg that is actually an executable | Anthropic API processes pixel data only; no code execution risk in Edge Function |
| Oversized payload | Submit 10MB image despite client compression | Edge Function rejects with 413; no processing occurs |
| API key extraction attempt | Client-side inspection of requests | ANTHROPIC_API_KEY never appears in client; only Edge Function secrets contain it |

### 5.5 Integration Test Scenarios

**Integration with Anthropic API**:
- **Scenario**: Edge Function correctly formats the Messages API request with image and system prompt
- **Test**: Assert request body schema; assert Authorization header uses correct key format
- **Expected**: 200 response with valid JSON content block
- **Error case**: 529 (overloaded) → return RATE_LIMITED error code to client

**Integration with Supabase Storage**:
- **Scenario**: Edge Function downloads image using signed URL
- **Test**: Upload test image; invoke Edge Function; verify image successfully retrieved
- **Expected**: Image bytes accessible; base64 encoding correct
- **Error case**: Signed URL expired → regenerate or return STORAGE_ERROR

**Integration with Supabase Database (RLS)**:
- **Scenario**: Edge Function inserts receipt and items using service role; client reads via user JWT
- **Test**: Verify RLS allows owner to read, blocks other user
- **Expected**: Owner SELECT returns rows; non-owner SELECT returns 0 rows

### 5.6 User Acceptance Test Scenarios

**UAT Scenario 1 — Primary Persona (Marta)**:
- **User Type**: Marta — busy professional, first-time use
- **Goal**: Photograph a Biedronka receipt and save it in under 30 seconds total
- **Steps**: Open app → tap camera shortcut → photograph receipt → review parsed items → tap Save
- **Success Criteria**: All items extracted; Marta makes 0–1 corrections; total time ≤ 30 seconds; she describes the experience as "easy"

**UAT Scenario 2 — Edge Case (Kasia)**:
- **User Type**: Kasia — parent tracking household grocery spend
- **Goal**: Upload a crumpled receipt from the bottom of her bag
- **Steps**: Select image from gallery → submit → receive partial results with low-confidence flags → correct 3 items → save
- **Success Criteria**: Marta can correct items without frustration; correction flow is obvious; no data lost

### 5.7 Regression Test Impact

**Affected Features**: Manual expense entry (US-005/006) — items saved via OCR and items saved manually share the `transactions` table; DB migration must not break existing manual entry

**Regression Tests Required**:
- [ ] Manual transaction entry (create, edit, delete) — verify `source` column default and FK additions don't break existing flows
- [ ] Cross-platform sync — verify new `receipt_items` table changes sync correctly via Supabase Realtime
- [ ] User authentication — verify Edge Function JWT validation doesn't regress auth flows

**New Regression Tests**:
- Receipt parsing pipeline end-to-end (added to CI suite using mocked Anthropic responses)
- RLS policy for `receipts` and `receipt_items` tables

---

## 6. Implementation Planning

### 6.1 Development Approach

**Phased Rollout**:
- **Phase 2A (Sprint 5) — Core parsing pipeline**: Edge Function + Anthropic integration + DB migration + loading screen. Goal: parsing works end-to-end with manual review/save via raw JSON (internal test only)
- **Phase 2B (Sprint 6) — Review UI + error flows**: `ReceiptReviewScreen` (US-012) + all error handling + confidence flagging + total mismatch warning. Goal: beta-ready for 10 internal users
- **Phase 2C (Sprint 6) — Polish + web support**: Gallery upload on web, duplicate detection, prompt accuracy tuning. Goal: public beta ready

**MVP Definition**:
- Must have for Phase 2A: FR-001, FR-002, FR-003, FR-005 (basic confidence flag), FR-006
- Can defer to 2B: FR-004 (category mapping, basic version in 2A), FR-007 (total validation)
- Can defer to 2C: Web gallery upload, duplicate detection, accuracy tuning

### 6.2 Timeline Estimate

| Phase | Activities | Duration | Dependencies |
|-------|-----------|----------|--------------|
| Spike | Prompt engineering; test 50 receipts; measure accuracy | 3 days | Anthropic API access; test receipt set |
| Design | Review screen UX; loading states; error screens | 2 days | Spike results |
| DB Migration | `receipts`, `receipt_items` tables; modify `transactions` | 1 day | Supabase project |
| Edge Function | Image download, Anthropic call, Zod validation, category mapping, DB insert | 4 days | DB migration; Anthropic API key |
| Mobile Integration | Upload flow; Edge Function call; loading + review screens | 4 days | Edge Function complete |
| Web Integration | File picker upload; same Edge Function | 2 days | Edge Function complete |
| QA & Accuracy | 100-receipt test set; accuracy measurement; prompt tuning | 3 days | Both integrations done |
| Staging Deploy | End-to-end on staging; beta user onboarding | 1 day | QA passed |
| **Total** | | **~20 days** | |

### 6.3 Resource Requirements

**Team Composition**:
- Full-stack developer: 1 person (Edge Function + mobile integration)
- Mobile developer: 1 person (if available; else same full-stack dev)
- QA: 1 person (test receipt set curation + accuracy measurement)
- Product manager: Part-time (prompt review + UAT)

**Skills Needed**:
- Supabase Edge Functions (Deno/TypeScript)
- Anthropic Messages API (vision)
- React Native / Expo (expo-image-picker, expo-image-manipulator)
- Zod schema validation
- PostgreSQL / Supabase RLS

**External Resources**:
- None required; all within existing team skill set

### 6.4 Risks and Mitigation

| Risk | Impact | Probability | Mitigation Plan | Owner |
|------|--------|-------------|-----------------|-------|
| Prompt accuracy < 80% after spike | High | Medium | Adjust scope: reduce retailer coverage for Phase 2 launch; launch with Biedronka + Żabka only; expand post-launch | Engineering |
| Anthropic API latency > 10s consistently | High | Low | Pre-upload image to reduce perceived latency; communicate realistic expectations in loading screen; 15s timeout with graceful fallback | Engineering |
| DB migration breaks existing manual entry | High | Low | Test migration on staging with production data snapshot; make all new columns nullable with defaults | Engineering |
| Supabase Storage access in Edge Function | Medium | Low | Use service role key in Edge Function; test signed URL generation in spike | Engineering |
| Test receipt set not representative enough | Medium | Medium | Source receipts from 5+ retailers; include crumpled, bright, low-light, and digital screenshots | QA |

---

## 7. Business Case

### 7.1 Business Value

**Revenue Impact**:
- OCR is the primary differentiator that separates Finance Lifestyle OS from manual-entry apps. Without it, Phase 2 does not advance product-market fit. Cannot quantify revenue directly at Phase 2 beta stage.

**Cost Savings**:
- Automation savings: Each parsed receipt saves the user ~3 minutes vs. manual entry. At 8 receipts/month, that's 24 minutes/month saved per user — a direct quality-of-life improvement that drives retention.

**Strategic Value**:
- **Competitive advantage**: SKU-level analytics (Phase 4) is only possible if itemized receipt data exists. This feature is the data foundation for everything that makes the product unique.
- **Retention driver**: Research on personal finance apps shows data entry friction is the #1 cause of churn within 30 days. Eliminating it is the product's primary retention lever.
- **User trust signal**: Accurate, near-instant parsing in the first session creates a strong "wow moment" — the key moment that converts a casual trier into a committed user.

### 7.2 Cost Analysis

**Development Costs**: Internal team time (~20 developer-days)

**Ongoing Costs**:
- Anthropic API: ~$5–25/month at Phase 2 scale (100 users, 8 receipts/month)
- Supabase Storage: Included in Pro plan for Phase 2 volume
- **Total monthly (Phase 2)**: ~$5–25/month

**Total Cost of Ownership (Year 1)**: Development time + ~$180–300 in Anthropic API costs

### 7.3 Priority Score

| Factor | Weight | Score (1-10) | Weighted Score |
|--------|--------|--------------|----------------|
| Business value | 30% | 10 | 3.0 |
| User impact | 25% | 10 | 2.5 |
| Strategic alignment | 20% | 10 | 2.0 |
| Feasibility | 15% | 8 | 1.2 |
| Risk level | 10% | 7 | 0.7 |
| **Total** | 100% | | **9.4 / 10** |

**Recommendation**: Approve — highest priority feature in Phase 2 with no viable deferral path.

---

## 8. User Experience Considerations

### 8.1 UI/UX Requirements

**Design Principles**:
- **Zero friction above the fold**: Camera shortcut must be reachable in one tap from the home screen; do not bury it in menus
- **Progress transparency**: Loading screen must show that something is happening ("Reading your receipt…") — a generic spinner is insufficient for a 5–10 second wait
- **Forgiving by default**: The review screen assumes the AI made at least one mistake; it should feel like a quick "check" not a chore — item correction must take no more than 2 taps

**Wireframe Concepts**:

```
Loading Screen:
┌──────────────────────────────────┐
│                                  │
│         [Receipt icon]           │
│                                  │
│    Reading your receipt…         │
│    ████████████░░░░░░  70%       │
│                                  │
│    Identifying 12 items          │
│                                  │
└──────────────────────────────────┘

Review Screen:
┌──────────────────────────────────┐
│ ← Receipt Review                 │
│ Biedronka · 15 Mar 2026          │
│ ─────────────────────────────── │
│ ⚠ 1 item needs review           │
│ ─────────────────────────────── │
│ ✓ Chleb Żytni 500g   1×  4.29  │
│ ✓ Masło Łaciate       1×  8.99  │
│ ⚠ [illegible]         1×  2.?? │  ← tap to correct
│ ✓ Woda Żywiec 1.5L   2×  3.49  │
│   ...                            │
│ ─────────────────────────────── │
│ Total: 87.43 PLN                │
│                                  │
│  [+ Add item]  [Save Receipt ✓] │
└──────────────────────────────────┘
```

**Interaction Patterns**:
- **Swipe to delete**: Swipe left on any item to reveal delete button (iOS standard pattern)
- **Tap to edit**: Tap any item to open an inline edit sheet (name, qty, price, category)
- **Add item**: Bottom sheet with manual entry form for missing items

**Responsive Design**:
- Mobile (primary): Full-screen review with scrollable item list; sticky "Save" button at bottom
- Web: Side-by-side layout — receipt image thumbnail on left, extracted items on right; useful for desktop review

### 8.2 Accessibility Requirements

- WCAG compliance: AA
- Keyboard navigation: Full support on web review screen
- Screen reader: All item fields labeled; confidence warning icons have aria-label ("Low confidence — tap to review")
- Color contrast: Warning yellow must meet 4.5:1 contrast ratio; do not rely on color alone for confidence (use icon + label)

### 8.3 Localization

**Languages Supported (Phase 2)**: Polish (primary); English (secondary for web)

**I18n Considerations**:
- Currency: Always PLN in Phase 2; format as `87,43 zł` (Polish locale)
- Dates: Display as `15 marca 2026` (Polish) or `15 Mar 2026` (English)
- Product names: Preserved in original Polish — never translated

---

## 9. Documentation Requirements

### 9.1 User Documentation
- [ ] In-app tooltip on first OCR use: "Take a clear, well-lit photo of the full receipt"
- [ ] FAQ entry: "Why didn't the app read my receipt correctly?"
- [ ] Help article: "Tips for best receipt scan results"

### 9.2 Technical Documentation
- [ ] Edge Function README: inputs, outputs, error codes, environment variables
- [ ] Database migration documentation: new tables and column changes
- [ ] Prompt template documented and versioned in repo (`supabase/functions/parse-receipt/prompts/v1.md`)
- [ ] API documentation: `POST /functions/v1/parse-receipt` request/response schema

### 9.3 Training Materials
- [ ] Internal demo script for beta user onboarding sessions

---

## 10. Success Criteria and Metrics

### 10.1 Launch Criteria
- [ ] TC-FR-001-001 through TC-FR-001-005 (all P0 test cases) pass
- [ ] ≥ 90% line-item accuracy on 100-receipt test set (measured pre-launch)
- [ ] P90 end-to-end latency ≤ 10s in staging environment
- [ ] Security review: RLS policies verified; API key not exposed to client
- [ ] Error flows tested: all 4 error scenarios return graceful client experience
- [ ] DB migration applied to staging without breaking manual entry

### 10.2 Success Metrics

**Immediate (Week 1 of Phase 2 beta)**:
- OCR adoption: ≥ 60% of beta users use OCR at least once
- Parse success rate: ≥ 95% of submitted receipts return at least 1 item (vs. error)
- Error rate: < 5% of parses result in a user-facing error

**Short-term (Month 1)**:
- OCR as primary entry: ≥ 70% of transactions entered via OCR (vs. manual)
- User correction rate: < 15% of extracted items corrected (proxy for accuracy)
- P90 latency in production: ≤ 10 seconds

**Long-term (Phase 2 complete)**:
- 30-day retention in Phase 2 cohort vs. Phase 1: target +20% improvement
- Manual entry as fallback only: < 30% of new transactions entered manually

### 10.3 Monitoring Plan

**Metrics to Track**:
- Parse success/failure rate: Supabase Edge Function logs + `receipts.parse_status` column
- Anthropic API latency: logged per-request in Edge Function; aggregate to P50/P90/P99
- User correction rate: `receipt_items.user_corrected = true` count ÷ total items
- API cost: Anthropic usage dashboard (token counts × price)

**Alert Thresholds**:
- Parse failure rate > 10% in a 1-hour window → investigate Edge Function logs
- Anthropic API P90 > 15s → check Anthropic status page; consider circuit breaker
- Anthropic API cost > $50/month → review usage; apply rate limits

**Review Cadence**:
- Daily (Phase 2 beta): Parse success rate, latency
- Weekly: Accuracy (correction rate), cost
- Monthly: Retention impact, feature adoption

---

## 11. Rollout Strategy

### 11.1 Deployment Plan

**Environment Progression**:
1. Development: Sprint 5 (internal only)
2. Staging: Sprint 6 start — 5 internal testers with real receipts
3. Production (Beta): Sprint 6 end — 10–20 invited beta users
4. Production (General): Phase 2 complete — all users

**Feature Flags**:
- Flag name: `ocr_enabled`
- Rollout strategy: Enable per user group (internal → beta → all)
- Rollback plan: Disable flag → OCR entry option hidden; users fall back to manual entry; no data loss

### 11.2 Beta Testing

**Beta User Selection**:
- Criteria: Heavy grocery shoppers who already expressed interest; mix of iOS and Android
- Number of users: 10–20
- Duration: 2 weeks before general Phase 2 release

**Beta Feedback Collection**:
- In-app feedback prompt after first 3 OCR parses: "How well did we read your receipt? 👍 👎"
- Weekly 15-minute interview with 3 beta users
- Usage analytics: parse count per user, correction rate, drop-off at review screen

### 11.3 Communication Plan

**Internal Communications**:
- Engineering: Sprint planning; daily standups during Sprint 5–6
- Product: Weekly demo of parsing accuracy on new receipt types

**External Communications**:
- Beta users: Email invitation + onboarding tips for best receipt photos
- General launch: In-app announcement: "New: Snap a receipt and we'll read it for you"

---

## 12. Appendix

### 12.1 Research and References
- Anthropic Messages API (vision): https://docs.anthropic.com/en/api/messages
- Supabase Edge Functions docs: https://supabase.com/docs/guides/functions
- expo-image-manipulator (image compression): https://docs.expo.dev/versions/latest/sdk/imagemanipulator/
- expo-image-picker (camera + gallery): https://docs.expo.dev/versions/latest/sdk/imagepicker/

### 12.2 Decision Log

| Date | Decision | Rationale | Decision Maker |
|------|----------|-----------|----------------|
| 2026-03-31 | Use Claude 3.5 Sonnet for OCR (not Google Vision) | Best accuracy for Polish receipts; no custom parser needed; aligns with existing Anthropic dependency | Product/Engineering |
| 2026-03-31 | Offline parsing deferred to future phase | Adds significant native module complexity; online-only is sufficient for Phase 2 beta | Product |
| 2026-03-31 | Single-image receipt only (no multi-page) | Covers 99% of use cases; simplifies pipeline | Product |
| 2026-03-31 | Store image in Supabase Storage, not embed in DB | Images are large; DB is for structured data; storage is cost-effective | Engineering |

### 12.3 Change History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-31 | Product/Founder | Initial feature spec from PRD Phase 2 + US-011 |

---

## Status and Next Steps

**Current Status**: Approved

**Next Steps**:
1. [ ] Source 50+ real Polish retail receipts for test set — Owner: QA — Due: Sprint 4
2. [ ] Run prompt engineering spike: test Claude on receipt test set; measure accuracy; document final prompt — Owner: Engineering — Due: Sprint 4
3. [ ] Resolve open question: image retention policy (GDPR) — Owner: Product — Due: Sprint 4
4. [ ] Resolve open question: closed vs. open category mapping strategy — Owner: Product — Due: Sprint 4
5. [ ] Begin DB migration implementation — Owner: Engineering — Due: Sprint 5 Day 1
6. [ ] Build Edge Function skeleton with Zod schema — Owner: Engineering — Due: Sprint 5 Day 2

**Approvals Required**:
- [ ] Product Manager / Founder
- [ ] Engineering Lead
- [ ] (Security review before Phase 2 production deployment)

**Target Dates**:
- Development start: Sprint 5
- Staging beta: Sprint 6 start
- Phase 2 general release: Sprint 6 end
