# macOS Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the web app to a native macOS look — SF system font, Apple system colors, frosted sidebar/toolbar, hairline borders — with zero functional changes.

**Architecture:** Define all colors as CSS custom properties that flip with `prefers-color-scheme`, exposed to Tailwind v4 via `@theme inline` so components use single classes (`bg-mac-surface`) with no `dark:` duplication. Deep-restyle the shell (Sidebar/TopBar/ChatSidebar); mechanically remap classes everywhere else using the table below.

**Tech Stack:** Tailwind v4 (CSS-in-CSS config in `app/globals.css`, no tailwind.config.js), Next.js 16 App Router.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-03-macos-restyle-design.md`.
- **No functional/logic changes; no copy changes** (e2e asserts on text).
- **Do not commit** — leave the working tree for user review.
- Web app only (`apps/web`); do not touch `apps/mobile`.
- Remove `dark:` variants when replacing a zinc pair with a `mac-*` token (the token flips itself).
- All paths relative to `apps/web/`.
- Verify after each task: `pnpm --filter web exec tsc --noEmit` (cheap) — full suite in the final task.

## Class mapping table (used by Tasks 3–6)

| Old (light + dark pair) | New |
|---|---|
| `bg-zinc-50 dark:bg-zinc-950` / page wrappers | `bg-mac-canvas` |
| `bg-white dark:bg-zinc-900` (cards/rows/panels) | `bg-mac-surface` |
| `bg-zinc-50 dark:bg-zinc-800`, input backgrounds `bg-white dark:bg-zinc-800` | `bg-mac-elevated` |
| `border-zinc-200 dark:border-zinc-800`, `border-zinc-300 dark:border-zinc-700`, divide equivalents | `border-mac-hairline` / `divide-mac-hairline` |
| `text-zinc-900 dark:text-zinc-100` (primary text) | `text-mac-label` |
| `text-zinc-500 dark:text-zinc-400`, `text-zinc-600 dark:text-zinc-300`, `text-zinc-700` | `text-mac-secondary` |
| `text-zinc-400 dark:text-zinc-500` (hints) | `text-mac-tertiary` |
| `text-emerald-600 dark:text-emerald-400` | `text-mac-green` |
| `text-red-600 dark:text-red-400` (amounts/negatives; keep form validation errors red) | `text-mac-red` |
| primary button `bg-zinc-900 … dark:bg-zinc-100 …` | `bg-mac-accent text-white hover:opacity-90 active:opacity-80` |
| secondary button `border … bg-white … hover:bg-zinc-100 …` | `border border-mac-hairline bg-mac-elevated text-mac-label hover:bg-mac-surface` |
| focus `focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500` + dark pair | `focus:border-mac-accent focus:ring-2 focus:ring-mac-accent/40 focus:outline-none` |
| `rounded-lg` on cards | `rounded-xl` (controls stay `rounded-lg`) |
| card shadow (none today) | add `shadow-[0_1px_3px_rgba(0,0,0,0.06)]` on cards only |

Judgment rule: match by *role* (card vs input vs button vs text tier), not by literal string only. Form validation error text stays `text-red-600 dark:text-red-400` → `text-mac-red`.

---

### Task 1: Design tokens + materials in `globals.css` and root layout

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx` (only if body classes hardcode colors)

**Interfaces:**
- Produces: Tailwind color utilities `mac-canvas, mac-surface, mac-elevated, mac-hairline, mac-label, mac-secondary, mac-tertiary, mac-accent, mac-green, mac-red`; CSS class `.mac-material`.

- [ ] **Step 1: Replace `app/globals.css` content**

```css
@import "tailwindcss";

:root {
  --background: #f5f5f7;
  --foreground: #1d1d1f;

  /* macOS palette — light */
  --mac-canvas: #f5f5f7;
  --mac-surface: #ffffff;
  --mac-elevated: #ffffff;
  --mac-hairline: rgba(0, 0, 0, 0.1);
  --mac-label: #1d1d1f;
  --mac-secondary: #6e6e73;
  --mac-tertiary: #aeaeb2;
  --mac-accent: #007aff;
  --mac-green: #34c759;
  --mac-red: #ff3b30;
  --mac-material-tint: rgba(255, 255, 255, 0.72);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #1c1c1e;
    --foreground: #f5f5f7;

    /* macOS palette — dark */
    --mac-canvas: #1c1c1e;
    --mac-surface: #2c2c2e;
    --mac-elevated: #3a3a3c;
    --mac-hairline: rgba(255, 255, 255, 0.14);
    --mac-label: #f5f5f7;
    --mac-secondary: #98989d;
    --mac-tertiary: #636366;
    --mac-accent: #0a84ff;
    --mac-green: #30d158;
    --mac-red: #ff453a;
    --mac-material-tint: rgba(28, 28, 30, 0.72);
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-mac-canvas: var(--mac-canvas);
  --color-mac-surface: var(--mac-surface);
  --color-mac-elevated: var(--mac-elevated);
  --color-mac-hairline: var(--mac-hairline);
  --color-mac-label: var(--mac-label);
  --color-mac-secondary: var(--mac-secondary);
  --color-mac-tertiary: var(--mac-tertiary);
  --color-mac-accent: var(--mac-accent);
  --color-mac-green: var(--mac-green);
  --color-mac-red: var(--mac-red);
  --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display',
    'Helvetica Neue', 'Segoe UI', Roboto, Arial, sans-serif;
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display',
    'Helvetica Neue', 'Segoe UI', Roboto, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* macOS vibrancy material — sidebar, toolbar */
.mac-material {
  background-color: var(--mac-material-tint);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
```

- [ ] **Step 2: Check `app/layout.tsx`** for hardcoded bg/text color classes on `<body>`; if present, replace with `bg-mac-canvas text-mac-label` (do not touch font wiring for Geist mono).

- [ ] **Step 3: Verify**: `pnpm --filter web exec tsc --noEmit` passes and `pnpm --filter web build` compiles CSS without errors.

- [ ] **Step 4: ~~Commit~~** Skipped (Global Constraints).

---

### Task 2: Shell — Sidebar, TopBar, ChatSidebar, DashboardShell

**Files:**
- Modify: `components/layout/Sidebar.tsx`, `components/layout/TopBar.tsx`, `components/layout/ChatSidebar.tsx`, `components/layout/DashboardShell.tsx`

**Interfaces:**
- Consumes: `.mac-material` + `mac-*` utilities (Task 1). No prop changes anywhere.

- [ ] **Step 1: Sidebar** — replace `<aside>` classes with `mac-material flex h-full w-60 flex-shrink-0 flex-col border-r border-mac-hairline`; app-name header: `border-b border-mac-hairline`, text `text-[13px] font-semibold text-mac-label`. Nav links (both states keep `flex items-center gap-3 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors`):
  - active: `bg-mac-accent/15 text-mac-accent`
  - inactive: `text-mac-secondary hover:bg-mac-label/5 hover:text-mac-label`

- [ ] **Step 2: TopBar** — header: `mac-material flex h-12 flex-shrink-0 items-center justify-between border-b border-mac-hairline px-4`. AI Coach toggle becomes a toolbar button: base `flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors`; active `bg-mac-accent/15 text-mac-accent`; inactive `text-mac-secondary hover:bg-mac-label/5 hover:text-mac-label`. Remove the ping animation span and indigo classes; keep the 💬 emoji and label. Email `text-xs text-mac-secondary`; divider `bg-mac-hairline`; logout button = secondary button per mapping table.

- [ ] **Step 3: ChatSidebar** — container: `bg-mac-surface border-l border-mac-hairline` (keep width/scroll behavior); user bubbles `bg-mac-accent text-white`; assistant bubbles `bg-mac-elevated text-mac-label`; input per mapping table focus style; send button = primary accent button.

- [ ] **Step 4: DashboardShell** — outer div gets `bg-mac-canvas`; `<main>` keeps layout classes only.

- [ ] **Step 5: Verify**: `tsc --noEmit`; `grep -n "zinc-\|indigo-" components/layout/*.tsx` returns nothing.

- [ ] **Step 6: ~~Commit~~** Skipped.

---

### Task 3: Dashboard page + QuickUpload

**Files:**
- Modify: `app/dashboard/page.tsx`, `components/receipts/QuickUpload.tsx`

- [ ] **Step 1: Apply the mapping table** to both files. Specifics:
  - Metric cards: `rounded-xl border border-mac-hairline bg-mac-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]`; income value `text-mac-green`, expenses `text-mac-red`, balance tone `text-mac-green`/`text-mac-red`.
  - Breakdown card + recent-transactions card: same card treatment; list dividers `divide-mac-hairline`; bar track `bg-mac-label/8`; bar color fallback `#6e6e73` → use `var(--mac-secondary)` via inline style `backgroundColor: cat.color ?? 'var(--mac-secondary)'`.
  - Category badge: `bg-mac-label/8 text-mac-secondary`.
  - QuickUpload dropzone: `rounded-xl border-2 border-dashed p-8` with idle `border-mac-hairline bg-mac-surface hover:border-mac-tertiary`, dragging `border-mac-accent bg-mac-accent/10`; spinner `border-mac-hairline border-t-mac-accent`; saved message `text-mac-green`, failure `text-mac-red`; headings `text-mac-label`, hints `text-mac-secondary`.

- [ ] **Step 2: Verify**: `tsc --noEmit`; `grep -n "zinc-\|emerald-" app/dashboard/page.tsx components/receipts/QuickUpload.tsx` returns nothing.

- [ ] **Step 3: ~~Commit~~** Skipped.

---

### Task 4: Transactions area

**Files:**
- Modify: `components/transactions/TransactionForm.tsx`, `components/transactions/TransactionList.tsx`, `app/dashboard/transactions/page.tsx`, `app/dashboard/transactions/new/page.tsx`, `app/dashboard/transactions/[id]/edit/page.tsx`

- [ ] **Step 1: Apply the mapping table.** Specifics:
  - Segmented control (type switcher): track `inline-flex rounded-lg bg-mac-label/8 p-0.5`; segment base `rounded-md px-3 py-1 text-xs font-medium transition-colors`; selected `bg-mac-surface text-mac-label shadow-[0_1px_2px_rgba(0,0,0,0.12)]`; unselected `text-mac-secondary hover:text-mac-label`.
  - Inputs/selects/textarea/date: `bg-mac-elevated border-mac-hairline rounded-lg` + accent focus per table.
  - Primary submit = accent button; cancel = secondary button.
  - List rows/badges: surface + hairline; income amounts `text-mac-green`, expense `text-mac-red`; type badges `bg-mac-green/15 text-mac-green` (income), `bg-mac-red/15 text-mac-red` (expense), transfer `bg-mac-label/8 text-mac-secondary`. **Do not change badge text.**

- [ ] **Step 2: Verify**: `tsc --noEmit`; `grep -rn "zinc-\|emerald-" components/transactions app/dashboard/transactions` returns nothing.

- [ ] **Step 3: ~~Commit~~** Skipped.

---

### Task 5: Wallets + settings/security

**Files:**
- Modify: everything under `components/wallets/`, `app/dashboard/wallets/` (list, new, [id]/edit), `app/dashboard/settings/security/page.tsx` and any components it renders (check `components/auth/` for 2FA setup pieces it imports)

- [ ] **Step 1: Apply the mapping table** (cards, forms, buttons, badges as in Tasks 3–4). Wallet balance positives `text-mac-green`, owed/negative `text-mac-red`.

- [ ] **Step 2: Verify**: `tsc --noEmit`; `grep -rn "zinc-\|emerald-" components/wallets app/dashboard/wallets app/dashboard/settings` returns nothing.

- [ ] **Step 3: ~~Commit~~** Skipped.

---

### Task 6: Auth + onboarding pages

**Files:**
- Modify: `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/verify-2fa/page.tsx`, remaining files in `components/auth/`, `app/onboarding/` pages/components, `app/page.tsx` (landing) if it uses zinc classes

- [ ] **Step 1: Apply the mapping table.** Auth card: `bg-mac-surface border border-mac-hairline rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]` on `bg-mac-canvas` page; primary CTA = accent button; links `text-mac-accent hover:underline`. **Do not change any visible copy** (auth e2e asserts field labels/headings).

- [ ] **Step 2: Verify**: `tsc --noEmit`; `grep -rn "zinc-\|emerald-" app/\(auth\) components/auth app/onboarding app/page.tsx` returns nothing.

- [ ] **Step 3: ~~Commit~~** Skipped.

---

### Task 7: Leftover sweep + full verification

- [ ] **Step 1: Global sweep**: `grep -rn "zinc-\|emerald-\|indigo-" app components --include="*.tsx"` — remap any stragglers by role using the mapping table (legitimate exceptions: none expected).
- [ ] **Step 2:** `pnpm --filter web exec vitest run` — all pass.
- [ ] **Step 3:** `pnpm --filter web lint` — no errors.
- [ ] **Step 4:** `pnpm --filter web build` — succeeds.
- [ ] **Step 5:** `pnpm --filter web test:e2e` — same pass/skip counts as before the restyle (10 passed / 5 skipped as of 2026-07-03).
- [ ] **Step 6:** Visual smoke: `pnpm --filter web dev`, check `/login` and `/dashboard` in light and dark (OS setting or DevTools emulation): frosted sidebar/toolbar, SF font, accent-blue active nav, hairline borders, green/red semantics.
- [ ] **Step 7:** Report results; leave tree uncommitted.
