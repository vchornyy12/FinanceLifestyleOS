# AI Coach — On-Demand Receipt Query Tool — Design

**Date:** 2026-07-03
**Status:** Approved by user.

## Goal

The coach can answer item-level questions about **any** period ("what did I buy in March?"), not just the 10 most recent receipts already inlined in its prompt, by calling a function that queries the DB on demand.

## Approach

OpenAI-style function calling against the NVIDIA NIM endpoint with a **streaming tool loop** (approach A; non-streaming rounds and server-side date parsing rejected). Nothing regresses if the configured model lacks tool support: the first call is retried without `tools` on API error, and a model that never calls tools behaves exactly as today.

## Components

### 1. `lib/chat/tools.ts` (new)

- `receiptQueryTool` — OpenAI `ChatCompletionTool` schema:
  - name `query_receipt_items`, description tells the model to use it for purchases not listed in the prompt.
  - params: `start_date` (string, `YYYY-MM-DD`, required), `end_date` (required), `search` (optional substring matched against raw/normalized/canonical product names, case-insensitive), `limit` (optional, 1–200, default 100).
- `ReceiptQueryArgsSchema` (Zod) validating the above; date format regex `^\d{4}-\d{2}-\d{2}$`.
- `executeReceiptQuery(supabase: SupabaseClient, rawArgs: unknown): Promise<string>` — returns a JSON string (tool message content):
  - valid args → query `receipt_items` with inner join to `transactions` (`source = 'ocr'`, `date` between start/end, order date desc), `.limit(limit + 1)` to detect truncation; optional `.or()` ilike filter across `name/normalized_name/canonical_product_name`;
  - result: `{ items: [{ date, merchant, name, quantity, total_price, category }], truncated: boolean }` with the display-name fallback chain and category-name unwrap reused from `shapeReceiptsWithItems`'s conventions;
  - invalid args or query error → `{ "error": "<message>" }` (model can recover); never throws.
- `assembleToolCallDeltas(deltas)` — pure accumulator turning streamed `delta.tool_calls` fragments (index-keyed, name + argument chunks) into `[{ id, name, arguments }]`.

### 2. `app/api/chat/route.ts`

Replace the single streaming call with a loop inside the existing `ReadableStream.start`:

- `messages` array starts as today (system + history + user).
- Up to **3 rounds**: call `chat.completions.create({ ..., stream: true, tools: [receiptQueryTool] })`.
  - Content deltas → enqueue to the client immediately (unchanged UX) and accumulate into `assistantReply`.
  - Tool-call deltas → collect via `assembleToolCallDeltas`.
  - `finish_reason === 'tool_calls'` → push assistant message with the tool_calls, then for each call push `{ role: 'tool', tool_call_id, content: await executeReceiptQuery(supabase, JSON.parse(arguments || '{}')) }` (JSON.parse failure → pass the raw string to the executor, which returns the error JSON); next round.
  - Otherwise → done.
- After round 3, if the model still wants tools, make a final call **without** `tools` so the user always gets prose.
- **Fallback:** if the *first* create call rejects (e.g. model doesn't support `tools`), retry that call once without `tools` and log `[chat] tools_unsupported`.
- Persistence of user/assistant messages unchanged (only final prose is saved).

### 3. `lib/chat/systemPrompt.ts`

One added line after the receipts section: the recent-receipt list is partial, and the model should call `query_receipt_items` for anything older or not shown.

## Error handling

- Tool executor never throws; errors surface to the model as `{error}` JSON.
- Tool-loop failure mid-stream falls back to existing `controller.error(err)` path.
- RLS: executor uses the request-scoped client — user's own rows only.

## Testing

- Unit: `ReceiptQueryArgsSchema` (accept/reject), `executeReceiptQuery` shaping + error JSON (mocked Supabase), `assembleToolCallDeltas` (fragmented arguments across chunks), system-prompt mention.
- Existing 92 tests stay green. Live tool-call round-trip requires the NIM key — verified in deployed app.
