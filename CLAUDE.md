# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Finance Lifestyle OS — an automated personal finance platform for Polish users. Captures transactions via (a) AI-powered receipt OCR (Claude 3.5 Sonnet vision) and (b) PSD2 open banking sync; layers SKU-level analytics, health-vs-wealth insights, and an AI coach on top. See `docs/PRD_Finance-Lifestyle-OS.md` for the full product spec and `docs/implementation-plans/` for per-phase IPs.

Shipped so far: auth (login/register/2FA), categories, manual transactions, and the shared receipt-OCR API (Phase 1–2). Phase 3 (banking) is in planning — `docs/implementation-plans/IP-20260408-003-full.md`.

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
Local SQL migrations live at the repo root in `supabase/migrations/` (not per-app). Apply them via the Supabase dashboard, CLI, or the Supabase MCP server configured in `.mcp.json` (project `agkvjwysvwvsmequbpub`). Every migration has a paired `_down.sql` — keep them in sync.

## Architecture

**Monorepo**: Turbo + pnpm workspaces (`apps/*`, `packages/*`). `packages/` is empty — shared code between web and mobile is currently duplicated (e.g. `lib/ocr/receiptSchema.ts`).

**Backend**: Single Supabase project serves both apps. Auth uses `@supabase/ssr` on web (cookie-based sessions) and `@supabase/supabase-js` + `expo-secure-store` on mobile. RLS is enforced on every user-owned table — see `supabase/migrations/002_rls_policies.sql`.

**Receipt OCR flow** (shared between web and mobile):
1. Client uploads image to Supabase Storage bucket `receipts/` at path `{userId}/{uuid}.jpg`.
2. Client POSTs the `storagePath` + bearer token to `apps/web/app/api/receipts/parse/route.ts`.
3. The API route validates the user, enforces 20 req/hour rate limit (in-memory map), signs a 120s URL, fetches the image, and calls Claude 3.5 Sonnet vision with `RECEIPT_SYSTEM_PROMPT` from `apps/web/lib/ocr/parseReceiptPrompt.ts`.
4. Response is validated against `ParsedReceiptSchema` (Zod) before being returned.

Mobile talks to this web route via `EXPO_PUBLIC_API_BASE_URL` — the Next.js server is the only backend; mobile never calls Anthropic directly.

**Web routing** (`apps/web/app/`, App Router):
- `(auth)/` — login, register, verify-2fa. Route group, no URL segment.
- `dashboard/` — protected shell, children include `transactions/`, `settings/`.
- `api/receipts/parse/route.ts` — OCR endpoint.
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
- **OCR API env**: needs `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Clients are lazy-initialized inside the handler so `next build` doesn't fail when env vars are absent at build time.
- **Deployment**: web ships to Netlify via `netlify.toml` (base `apps/web`, pins `@netlify/plugin-nextjs` v5 — required for OpenNext on a monorepo). Mobile builds via EAS (`apps/mobile/eas.json`, project id in `app.json`).
- **Playwright** runs with `workers: 1` and `fullyParallel: false` — tests share the dev Supabase DB. Don't flip this on without isolating test data first.
