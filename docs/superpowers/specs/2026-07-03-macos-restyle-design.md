# macOS Restyle — Design

**Date:** 2026-07-03
**Status:** Drafted autonomously (user was AFK for the style-depth question). Chosen: **native macOS app feel**. Alternatives if the user disagrees: "Apple-clean marketing aesthetic" (apple.com-like, no OS chrome) or "light reskin" (fonts + accent + radius only).

## Goal

The web app (`apps/web`) should look and feel like a native macOS app: translucent sidebar, SF system font, Apple system colors, hairline borders, macOS-radius cards and controls. Light/dark follows the OS (existing `dark:` variant behavior). No functional changes, no route changes, no test-visible copy changes.

Out of scope: the mobile app; restructuring components into a UI library.

## Approach (chosen: A)

- **A. Token-first + targeted restyle (chosen):** define the palette/typography/materials once in `globals.css` via Tailwind v4 `@theme`, then update components to use the tokens; deep restyle only where macOS identity lives (sidebar, toolbar).
- B. Component-library refactor (extract Button/Card/Input first) — cleaner long-term, but a much larger, riskier diff. YAGNI now.
- C. CSS-only reskin — can't deliver vibrancy/sidebar identity.

## Design tokens (`app/globals.css`)

Font stack (body, replaces Arial):
```
-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', 'Segoe UI', Roboto, Arial, sans-serif
```

`@theme` colors (light / dark via `prefers-color-scheme` on `:root` custom properties, exposed as Tailwind colors):

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-mac-canvas` | `#f5f5f7` | `#1c1c1e` | page/content background |
| `--color-mac-surface` | `#ffffff` | `#2c2c2e` | cards, panels, table rows |
| `--color-mac-elevated` | `#ffffff` | `#3a3a3c` | inputs, hover surfaces |
| `--color-mac-hairline` | `rgba(0,0,0,0.10)` | `rgba(255,255,255,0.14)` | all borders |
| `--color-mac-label` | `#1d1d1f` | `#f5f5f7` | primary text |
| `--color-mac-secondary` | `#6e6e73` | `#98989d` | secondary text |
| `--color-mac-tertiary` | `#aeaeb2` | `#636366` | hints, placeholders |
| `--color-mac-accent` | `#007aff` | `#0a84ff` | links, primary buttons, focus rings, active nav |
| `--color-mac-green` | `#34c759` | `#30d158` | income / positive |
| `--color-mac-red` | `#ff3b30` | `#ff453a` | expenses / negative |

Because the values flip via CSS variables, components use one class (e.g. `bg-mac-surface`, `text-mac-label`, `border-mac-hairline`) with **no `dark:` duplication** — existing `dark:` pairs are removed as files are touched.

Materials (plain CSS classes in `globals.css`, used by shell components):
- `.mac-material` — `backdrop-filter: blur(20px) saturate(180%)` over a translucent surface tint (`rgba(255,255,255,0.72)` light / `rgba(28,28,30,0.72)` dark). Used by sidebar and toolbar.

## Component treatment

- **Sidebar** (`components/layout/Sidebar.tsx`): frosted (`.mac-material`), hairline right border, macOS source-list nav — 13px medium labels, secondary-color inactive icons, active item = accent-tinted rounded-md pill (`bg-mac-accent/15 text-mac-accent` style), not the current black pill.
- **TopBar** (`components/layout/TopBar.tsx`): becomes a toolbar — frosted, hairline bottom border; AI Coach toggle restyled as a macOS toolbar button (accent tint when active; drop the indigo/ping styling).
- **ChatSidebar** (`components/layout/ChatSidebar.tsx`): surface + hairline left border; message bubbles accent (user) / elevated (assistant).
- **Cards** (dashboard metric cards, breakdown, lists, QuickUpload, forms): `bg-mac-surface`, `border-mac-hairline`, `rounded-xl`, `shadow-[0_1px_3px_rgba(0,0,0,0.06)]`.
- **Buttons**: primary = accent-filled, white text, `rounded-lg`, `active:opacity-80`; secondary = `bg-mac-elevated` + hairline. Applies to auth pages, forms, wallets, transactions.
- **Inputs/selects/textareas**: `bg-mac-elevated`, hairline border, `rounded-lg`, focus = accent ring (`focus:ring-2 ring-mac-accent/50`).
- **Segmented control** (TransactionForm type switcher): macOS style — recessed `bg-mac-canvas` track, selected segment = white/dark elevated with subtle shadow.
- **Semantics**: income/positive `text-mac-green`, expense/negative `text-mac-red` everywhere (replaces emerald/red).
- **Category bars** (dashboard breakdown): keep per-category DB colors; fallback becomes `--color-mac-secondary`.
- Auth + onboarding pages: same tokens (canvas background, surface card).

Not doing: traffic-light window dots, custom scrollbars, animations beyond existing transitions.

## Files touched

`app/globals.css` (tokens + materials), `app/layout.tsx` (body font/canvas if needed), all files under `components/` (35 files use zinc classes), `app/(auth)/*`, `app/dashboard/**`, `app/onboarding/*`. Mechanical class substitution guided by a mapping table (zinc-50/100→canvas or elevated, white/zinc-900 surfaces→surface, zinc-200/800 borders→hairline, zinc-900/100 text→label, zinc-500/400→secondary, emerald→mac-green, red→mac-red, focus outlines→accent).

## Error handling / testing

- No logic changes; unit tests unaffected. E2E selectors use roles/text, not classes — suite must still pass.
- Verification: `tsc --noEmit`, lint, `vitest run`, Playwright e2e, `pnpm --filter web build`, plus visual check of dashboard/login in light + dark.
