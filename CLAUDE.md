# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Finance Lifestyle OS — an automated personal finance platform for Polish users. Captures transactions via (a) AI-powered receipt OCR (Claude 3.5 Sonnet vision) and (b) PSD2 open banking sync; layers SKU-level analytics, health-vs-wealth insights, and an AI coach on top. See `docs/PRD_Finance-Lifestyle-OS.md` for the full product spec and `docs/implementation-plans/` for per-phase IPs.

Shipped: auth (login/register/2FA), categories, manual transactions, wallets, receipt OCR (async), product normalization/enrichment pipeline, category learning, and an AI chat coach. Phase 3 (banking) is in planning — `docs/implementation-plans/IP-20260408-003-full.md`.

## Commands

### Root
```bash
pnpm install                       # install all workspace deps
pnpm dev                           # Turbo: runs dev for all apps
pnpm build                         # Turbo: builds all apps
pnpm lint                          # Turbo: lints all apps
```

### Web (`apps/web`, Next.js 16)
```bash
pnpm --filter web dev              # http://localhost:3000
pnpm --filter web build            # production build (used by Netlify)
pnpm --filter web lint             # ESLint 9 flat config
pnpm --filter web test:unit        # Vitest (API route tests, node env)
pnpm --filter web test:e2e         # Playwright (auto-starts dev server)
# single test:
pnpm --filter web exec vitest run __tests__/api/receipts-parse.test.ts
pnpm --filter web exec playwright test __tests__/e2e/auth.spec.ts
```

### Mobile (`apps/mobile`, Expo SDK 52 + Expo Router)
```bash
pnpm --filter mobile start         # Expo dev server (Metro)
pnpm --filter mobile android       # run on Android (requires native build)
pnpm --filter mobile ios           # run on iOS
pnpm --filter mobile lint
```

No mobile test runner is configured.

### Supabase
Local SQL migrations live at the repo root in `supabase/migrations/` (not per-app). Apply them via the Supabase dashboard, CLI, or the Supabase MCP server configured in `.mcp.json` (project `agkvjwysvwvsmequbpub`). Every migration has a paired `_down.sql` — keep them in sync. Current schema is through `016_category_learning`.

## Architecture

**Monorepo**: Turbo + pnpm workspaces (`apps/*`, `packages/*`). `packages/` is empty — shared code between web and mobile is currently duplicated (e.g. `lib/ocr/receiptSchema.ts`).

**Backend**: Single Supabase project serves both apps. Auth uses `@supabase/ssr` on web (cookie-based sessions) and `@supabase/supabase-js` + `expo-secure-store` on mobile. RLS is enforced on every user-owned table — see `supabase/migrations/002_rls_policies.sql`.

**Receipt OCR flow** (async, shared between web and mobile):
1. Client uploads image to Supabase Storage bucket `receipts/` at path `{userId}/{uuid}.jpg`.
2. Client POSTs `storagePath` + Bearer token to `apps/web/app/api/receipts/parse/route.ts`, which creates a `receipt_parse_jobs` row and fires `apps/web/netlify/functions/ocr-process-background.ts` via HTTP (non-blocking). Returns `202 { jobId }` immediately.
3. The background function calls Claude 3.5 Sonnet with `RECEIPT_SYSTEM_PROMPT`, validates against `ParsedReceiptSchema` (Zod), runs the normalization + enrichment + category-learning pipeline, then writes the result back to `receipt_parse_jobs.result`.
4. Client polls `GET /api/receipts/jobs/[id]` until `status` is `done` or `error`. Stalled jobs (processing > 5 min) return `errorCode: STALLED`.
5. Supported file types: JPEG/PNG/WebP (≤5 MB), PDF (≤20 MB, text extracted via `pdf-parse`), plain text/CSV (≤1 MB).

Mobile talks to these web routes via `EXPO_PUBLIC_API_BASE_URL` — the Next.js server is the only backend; mobile never calls Anthropic directly.

**AI Chat coach** (`apps/web/app/api/chat/route.ts`):
- Uses the NVIDIA NIM API via the OpenAI SDK (`NVIDIA_API_KEY`, `NVIDIA_BASE_URL`).
- Builds a system prompt from live financial context: monthly metrics, wallet balances, recent transactions, and top receipt products (`lib/chat/systemPrompt.ts`).
- 20 req/hour in-memory rate limit per user. Accepts Bearer auth (for mobile) or cookie session.

**Product normalization + enrichment pipeline** (`apps/web/lib/normalization/`, `apps/web/lib/enrichment/`):
- Runs inside the background OCR function after Claude parses the receipt.
- `normalize.ts` applies Polish character folding, abbreviation expansion (from `global_retailer_name_mappings` DB table), tokenization, and SHA-1 fingerprinting.
- `enrichment/factory.ts` dispatches to Open Food Facts (`openFoodFacts.ts`) or GS1 (`gs1.ts`) to resolve `canonical_product_name`, `brand`, `gtin`.
- Results are stored in `receipt_items` with enrichment columns (`013_receipt_item_enrichment` migration).

**Category learning** (`apps/web/lib/supabase/queries/categoryLearning.ts`):
- After each OCR parse, `lookupCategoryFromHistory` (RPC) checks if the user has previously categorized the same product and pre-fills the category suggestion.
- When a user saves or corrects a receipt, `upsertCategoryLearning` (RPC) records the `raw_name → category_id` mapping in `category_learning` (migration `016`).

**Wallets** (`apps/web/lib/supabase/queries/wallets.ts`):
- Wallet balances are kept in sync by DB triggers — do not update `balance` directly; go through transactions.
- `lib/actions/wallets.ts` has Server Actions for create/update/delete.

**Web routing** (`apps/web/app/`, App Router):
- `(auth)/` — login, register, verify-2fa. Route group, no URL segment.
- `dashboard/` — protected shell; children: `transactions/`, `settings/`, `wallets/`, `receipts/`.
- `onboarding/` — post-registration setup flow.
- `api/receipts/parse/` — async OCR submit (returns `jobId`).
- `api/receipts/jobs/[id]/` — job status polling endpoint.
- `api/chat/` — AI coach chat endpoint.
- `proxy.ts` — Next.js 16 renamed `middleware.ts` to `proxy.ts`. This file refreshes the Supabase session on every request and gates `/dashboard/*` behind auth. **Do not rename it back to `middleware.ts`.** See `apps/web/AGENTS.md` for the reminder.

**Mobile routing** (`apps/mobile/app/`, Expo Router file-based):
- `(auth)/` — login, register, verify-2fa, biometric-setup.
- `(tabs)/` — bottom-tab shell: index, transactions, settings.
- `(camera)/` — capture + preview for receipt photos.
- `(review)/` — parsed-receipt confirmation screen.
- `transactions/new` — manual-entry form.

## Key Decisions and Gotchas

- **Next.js 16**: APIs have changed. `apps/web/AGENTS.md` instructs agents to read `node_modules/next/dist/docs/` before writing Next code. Most visible breakage: middleware is now `proxy.ts` with an exported `proxy` function (not `middleware`).
- **Tailwind differs between apps**: web uses Tailwind v4 with `@tailwindcss/postcss` and CSS-in-CSS config in `globals.css` (no `tailwind.config.js`). Mobile uses Tailwind v3 + NativeWind v4, which **requires** `apps/mobile/tailwind.config.js` — do not delete it.
- **Package manager**: pnpm only. `packageManager` is pinned to `pnpm@10.33.0`. `pnpm-workspace.yaml` declares `apps/*` and `packages/*`.
- **Path alias `@/*`**: resolves to each app's own root (`apps/web/` or `apps/mobile/`). Not shared across apps.
- **Supabase client initialization**: on web, `lib/supabase/client.ts` for browser, `lib/supabase/server.ts` for RSC/route handlers (uses `next/headers` cookies), and the API route creates a service-role admin client inline for OCR auth validation. On mobile, `lib/supabase.ts` wires `SecureStore` as the session storage adapter.
- **Env vars**: see `apps/web/.env.local.example` for base vars. The background OCR function additionally needs `ANTHROPIC_API_KEY`. The chat API needs `NVIDIA_API_KEY` + `NVIDIA_BASE_URL`. Async OCR signing uses `BG_TRIGGER_SECRET` (optional HMAC) and `URL` (Netlify site URL, defaults to `http://localhost:8888`). All clients are lazy-initialized inside handlers so `next build` never fails on missing env vars at build time.
- **Supabase generated types**: `apps/web/types/database.ts` is generated from the Supabase schema. Regenerate with `supabase gen types typescript --project-id agkvjwysvwvsmequbpub > apps/web/types/database.ts` after schema changes.
- **Deployment**: web ships to Netlify via `netlify.toml` (base `apps/web`, pins `@netlify/plugin-nextjs` v5 — required for OpenNext on a monorepo). Mobile builds via EAS (`apps/mobile/eas.json`, project id in `app.json`).
- **Playwright** runs with `workers: 1` and `fullyParallel: false` — tests share the dev Supabase DB. Don't flip this on without isolating test data first.
