# AI Coach — Receipt Line Items Context — Design

**Date:** 2026-07-03
**Status:** Approved by user (option: recent receipts, full items).

## Goal

The AI coach can answer questions about positions on uploaded receipts ("what did I buy at Biedronka on Tuesday?", "what was the most expensive item on my last receipt?"). Today its context has monthly metrics, wallets, 50 recent transactions, and monthly top-10 products — no per-receipt items.

## Approach

Inject line items of the **10 most recent receipts** into the chat system prompt (same pattern as every other context section). Tool-calling/RAG rejected as over-engineering at this scale; "latest receipt only" and "whole month" rejected per user choice.

## Changes

1. **`lib/supabase/queries/receiptItems.ts`** — add:
   - `interface ReceiptWithItems { merchant: string; date: string; total: string; items: Array<{ name: string; quantity: number; total_price: number; category: string | null }> }`
   - `getRecentReceiptsWithItems(limit = 10, supabaseClient?): Promise<ReceiptWithItems[]>` — latest `source = 'ocr'` transactions (newest first) joined with their `receipt_items` and each item's category name; item display name uses the existing fallback chain `canonical_product_name → normalized_name → name`; hard cap of 150 items across all receipts (drop oldest receipts first).
   - Export a pure shaping helper so it's unit-testable without Supabase.

2. **`lib/chat/systemPrompt.ts`** — new `recentReceipts: ReceiptWithItems[]` field in `PromptContext`; renders:

   ```
   ## Recent receipts (line items)
   ### Biedronka — 2026-07-02 — 84.32 PLN
   - Chleb zwykły ×1 — 3.49 (Groceries)
   ...
   ```

   Empty state: `No receipts scanned yet.`

3. **`app/api/chat/route.ts`** — add `getRecentReceiptsWithItems(10, supabase)` to the existing `Promise.all`; pass into `buildSystemPrompt`. A query failure must not break chat: wrap in `.catch(() => [])`.

## Error handling / testing

- Query failure → empty array → coach answers from remaining context.
- Unit tests: shaping helper (grouping, fallback names, 150-item cap) and system-prompt rendering (section present, empty state). Existing chat/systemPrompt tests remain green.
- No UI, schema, or mobile changes; Bearer-auth path works identically since the query takes the request-scoped client.
