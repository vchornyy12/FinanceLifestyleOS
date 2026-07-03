# Zero-Touch Receipts & Simplified Dashboard — Design

**Date:** 2026-07-02
**Status:** Drafted autonomously (user was AFK when clarifying questions were asked). Decisions below default to the most automatic option; each section notes what to change if the user disagrees.

## Goal

As a lazy user I want:
1. Minimum steps to get a store receipt into the system (upload → done).
2. No manual category management — categorization is fully automatic.
3. A dashboard focused on displaying my expenses and income.

Scope: **web app only** (`apps/web`). The mobile app keeps working against the same API; aligning its UI is a follow-up.

## Decisions

| Question | Decision | Alternative if user disagrees |
|---|---|---|
| Review step after OCR? | None. Auto-save in background. | One-tap confirm card |
| Categories in UI? | Hidden everywhere; AI + learning assign them silently. They still exist in the DB and power the dashboard breakdown. | Read-only display |
| Wallet for auto-saved receipts? | Oldest wallet by `created_at`; `null` if the user has none (transaction still saves). | Default-wallet setting |
| Dashboard content | Upload zone + income/expense/balance cards + spending-by-category + recent transactions | — |
| DB migrations | None destructive. `categories`, `category_learning` untouched. | — |

## Architecture

### 1. Auto-save in the background OCR function

`apps/web/netlify/functions/ocr-process-background.ts` already parses (Claude), normalizes, enriches, and looks up category history per item. Extend it: after building `enrichedItems`, and before marking the job `done` — **but only when the job was created with `auto_save = true`**:

**Opt-in flag (mobile compatibility):** migration `017_receipt_jobs_auto_save.sql` adds `auto_save boolean not null default false` to `receipt_parse_jobs` (paired `_down.sql`). The parse route accepts `{ autoSave?: boolean }` and stores it on the job. The new web QuickUpload sends `autoSave: true`; the mobile app doesn't send it, keeps its review flow, and never double-saves.

1. **Resolve category per item** (service-role client, scoped to `job.user_id`):
   - use `history_category_id` when present (existing learning lookup);
   - else fuzzy-match the AI's `category` string against the user's `categories` rows (port `matchCategory` from `ReceiptUploader.tsx` into a shared helper `lib/ocr/resolveCategory.ts`);
   - else fall back to the user's "Other" category (or `null` if none).
2. **Resolve wallet**: user's oldest wallet by `created_at`; `null` if the user has none (the existing save path already allows `wallet_id: null`).
3. **Save**: insert `transactions` row (`type: 'expense'`, `source: 'ocr'`) + `receipt_items` rows — same shape as the current `saveReceipt` server action, moved into a shared module `lib/receipts/autoSave.ts` that accepts a Supabase client, so the logic is testable and not duplicated.
4. **Learning**: upsert `category_learning` for every item that got a category (passive weight, `user_changed_category=false`) — same as the current save path.
5. Write `status: 'done'` with `result` including `transaction_id`. Save happens inside the single claimed `processing` transition, so it runs at most once per job.

If the save fails, the job is marked `error` with a new `errorCode: SAVE_FAILED` so the client can surface it.

### 2. Upload UI — dropzone on the dashboard

- New client component `components/receipts/QuickUpload.tsx`: a drag-and-drop / tap-to-pick zone rendered at the top of the dashboard page. On file pick it uploads to Storage, POSTs `/api/receipts/parse`, then polls the job **only to show status** ("Processing… → Saved ✓ / failed"). The user can navigate away; the save happens server-side regardless.
- On `done`, call `router.refresh()` so the dashboard numbers update in place.
- Delete the review flow: `components/receipts/ReceiptUploader.tsx`, `app/dashboard/receipts/*` pages. Keep `app/dashboard/receipts/upload/actions.ts` logic only insofar as it moves into `lib/receipts/autoSave.ts`; the server action itself is deleted.

### 3. Categories become invisible

- Delete `app/dashboard/settings/categories/` page, `components/categories/*`, and the categories link in settings/sidebar.
- `TransactionForm` (manual entry): remove the category picker; `category_id` is saved as `null` (shown as "Other" in breakdowns). Manual entry stays for income and cash expenses.
- Transaction list/detail: show the auto-assigned category as a plain badge (no editing UI in this pass — correcting a category can be a follow-up; the learning table already supports it).
- DB: nothing dropped. Default categories continue to be seeded at registration.

### 4. Dashboard = expenses & income

`app/dashboard/page.tsx` becomes:
1. **QuickUpload** zone (primary action, top).
2. **Income / Expenses / Balance** cards for the current month (reuse `getMonthlyMetrics`, wallet totals).
3. **Spending by category** for the month — new query `getMonthlyCategoryBreakdown` joining transactions → categories (uncategorized bucketed as "Other"); rendered as a simple horizontal-bar list (no chart library).
4. **Recent transactions** (last 10, reuse existing queries) with link to the full list.

Removed from dashboard: wallets grid (wallets remain reachable under Settings → Wallets), top-products list, upload-shortcut banner (replaced by the dropzone).

### 5. Navigation

Sidebar shrinks to: **Overview, Transactions, Wallets, Security**. Receipts and Categories links disappear (there is no standalone Settings hub page today, so wallets/security stay as direct links).

## Error handling

- Parse/save failures: job `error` + `errorCode` (`PARSE_FAILED`, `NO_ITEMS_FOUND`, `SAVE_FAILED`, …). QuickUpload shows a human message with a "try again" affordance.
- Duplicate protection: job claim (`pending → processing`) already guarantees one save per job.
- Total discrepancy (`discrepancy_warning`): still saved (lazy-user principle), transaction is created with the receipt's stated total; warning retained in job result for later surfacing if needed.

## Testing

- Unit (Vitest): `resolveCategory` matching, `autoSave` happy path + no-wallet path + failure path (mocked Supabase), parse route unchanged tests keep passing.
- Existing tests referencing deleted routes/components are removed or updated.
- E2E (Playwright): dashboard renders income/expense cards; upload zone visible. (Full OCR e2e already isn't covered; unchanged.)

## Out of scope

- Mobile app UI alignment. Mobile keeps its review flow safely because auto-save is opt-in per job (`auto_save` flag); aligning mobile with zero-touch is a follow-up.
- Category correction UI on transactions.
- Removing category tables/migrations.
