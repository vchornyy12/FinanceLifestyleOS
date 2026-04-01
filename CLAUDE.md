# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Finance Lifestyle OS is an intelligent financial lifestyle management platform — a monorepo combining a Next.js web app with plans for a React Native mobile app. The project is in early scaffolding phase.

## Commands

### Root (run from repo root)
```bash
pnpm install       # Install all workspace dependencies
pnpm dev           # Start all apps in dev mode (Turbo orchestrated)
pnpm build         # Build all packages
pnpm lint          # Lint all packages
```

### Web App (apps/web)
```bash
pnpm dev           # Next.js dev server at http://localhost:3000
pnpm build         # Production build
pnpm lint          # ESLint
```

No test suite is configured yet.

## Architecture

**Monorepo** managed by Turbo + pnpm workspaces:
- `apps/web` — Next.js 16 app (React 19, TypeScript, Tailwind CSS v4)
- `packages/` — shared packages directory (currently empty)
- `docs/` — product requirements

**Web app** uses the Next.js App Router (`apps/web/app/`). Currently only the root layout and placeholder home page exist. The layout sets up Geist Sans/Mono fonts via CSS variables (`--font-geist-sans`, `--font-geist-mono`).

**Planned integrations** (not yet implemented):
- Supabase for database/auth
- Claude AI (claude-3-5-sonnet) for receipt OCR and NLP
- GoCardless / Salt Edge for PSD2 open banking
- React Native + Expo for mobile

## Key Decisions

- **Tailwind v4**: Uses `@tailwindcss/postcss` plugin (CSS-in-CSS config in `globals.css`), not a `tailwind.config.js` file.
- **ESLint 9 flat config**: Config is in `eslint.config.mjs` (not `.eslintrc`).
- **Path alias**: `@/*` resolves to `apps/web/` root.
- **Package manager**: Must use `pnpm` — do not use `npm` or `yarn`.
