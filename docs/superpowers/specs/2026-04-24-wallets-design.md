# Wallets (Accounts) Feature — Design Spec

**Date:** 2026-04-24  
**Status:** Approved  
**Scope:** Web (Next.js 16) + Mobile (Expo SDK 52) + Supabase DB

---

## Overview

Add wallet/account management to Finance Lifestyle OS. Users can create and manage multiple accounts (cash, debit, credit card, savings, investment, crypto). Every expense debits a wallet, every income credits one, and transfers move money between two wallets. Balances are computed on the fly from transactions — never stored — ensuring they are always accurate. New users are guided through an onboarding wizard to set up their wallets before accessing the dashboard.

---

## 1. Data Model

### 1.1 New enum: `wallet_type`

```sql
CREATE TYPE public.wallet_type AS ENUM (
  'cash', 'debit', 'credit_card', 'savings', 'investment', 'crypto'
);
```

### 1.2 New table: `wallets`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid` NOT NULL FK `auth.users` | `ON DELETE CASCADE` |
| `name` | `text` NOT NULL | e.g. "PKO Bank", "Cash" |
| `type` | `wallet_type` NOT NULL | see enum above |
| `currency` | `text` NOT NULL DEFAULT `'PLN'` | ISO 4217 code |
| `opening_balance` | `numeric(14,2)` NOT NULL DEFAULT `0` | balance when user started tracking |
| `credit_limit` | `numeric(14,2)` | `NULL` unless type = `credit_card` |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

**Constraint:** `credit_limit` must be `NULL` when type ≠ `credit_card`, and NOT NULL (> 0) when type = `credit_card`.

**RLS:** User can only SELECT/INSERT/UPDATE/DELETE their own rows (`user_id = auth.uid()`).

**Indexes:** `idx_wallets_user_id ON wallets(user_id)`

### 1.3 Changes to `transactions`

Three new nullable FK columns:

```sql
ALTER TABLE public.transactions
  ADD COLUMN wallet_id      uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  ADD COLUMN from_wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  ADD COLUMN to_wallet_id   uuid REFERENCES public.wallets(id) ON DELETE SET NULL;
```

Old free-text columns removed:
```sql
ALTER TABLE public.transactions
  DROP COLUMN from_account,
  DROP COLUMN to_account;
```

Updated transfer integrity CHECK:
```sql
-- Drop old check
ALTER TABLE public.transactions
  DROP CONSTRAINT transactions_transfer_endpoints;

-- Add new check using FK columns
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transfer_endpoints CHECK (
    (type = 'transfer' AND from_wallet_id IS NOT NULL AND to_wallet_id IS NOT NULL AND wallet_id IS NULL)
    OR
    (type <> 'transfer' AND from_wallet_id IS NULL AND to_wallet_id IS NULL)
  );
```

All three new columns are nullable so existing transactions are unaffected.

### 1.4 Change to `profiles`

```sql
ALTER TABLE public.profiles
  ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
```

Used by the proxy/middleware to decide whether to redirect new users to `/onboarding`.

### 1.5 Balance computation

A Postgres function computes a wallet's current balance on demand:

```sql
CREATE OR REPLACE FUNCTION public.get_wallet_balance(p_wallet_id uuid)
RETURNS numeric(14,2)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    w.opening_balance
    + COALESCE((SELECT SUM(amount) FROM transactions WHERE wallet_id = p_wallet_id AND type = 'income'), 0)
    - COALESCE((SELECT SUM(amount) FROM transactions WHERE wallet_id = p_wallet_id AND type = 'expense'), 0)
    + COALESCE((SELECT SUM(amount) FROM transactions WHERE to_wallet_id = p_wallet_id AND type = 'transfer'), 0)
    - COALESCE((SELECT SUM(amount) FROM transactions WHERE from_wallet_id = p_wallet_id AND type = 'transfer'), 0)
  FROM wallets w
  WHERE w.id = p_wallet_id
$$;
```

For **credit cards**: `available_credit = credit_limit - balance` (balance = amount currently owed).  
For all other types: balance is the current available amount.

---

## 2. Wallet CRUD — Web

### 2.1 Routes

| Route | Component | Description |
|---|---|---|
| `/dashboard/wallets` | `WalletList` | Grid of wallet cards with computed balances |
| `/dashboard/wallets/new` | `WalletForm` | Create wallet |
| `/dashboard/wallets/[id]/edit` | `WalletForm` | Edit wallet |

Delete is an inline button on each wallet card with a confirmation step (no separate route).

### 2.2 Wallet card display

Each card shows:
- Type icon + wallet name
- Currency
- Current balance (from `get_wallet_balance`)
- For credit cards: "Owed: X PLN / Limit: Y PLN / Available: Z PLN"
- Edit and Delete action buttons

Type icons: 💵 cash · 🏦 debit · 💳 credit_card · 🏧 savings · 📈 investment · ₿ crypto

### 2.3 WalletForm fields

| Field | Types | Notes |
|---|---|---|
| Name | all | text, required |
| Type | all | select, required (shown only on create) |
| Currency | all | select or text, default PLN |
| Opening balance | all | numeric, default 0 |
| Credit limit | credit_card only | numeric > 0, required for credit_card |

### 2.4 Server actions (`lib/actions/wallets.ts`)

- `createWallet(prevState, formData)` — validates with Zod, inserts, revalidates `/dashboard/wallets`
- `updateWallet(prevState, formData)` — validates, updates own wallet (defence-in-depth `.eq('user_id', user.id)`)
- `deleteWallet(prevState, formData)` — deletes; affected transactions have wallet FKs set to NULL via CASCADE

### 2.5 Zod schema (`lib/schemas/wallet.ts`)

Validates all fields; uses `.superRefine` to require `credit_limit` when `type === 'credit_card'` and reject it otherwise.

### 2.6 Query helper (`lib/supabase/queries/wallets.ts`)

- `getUserWalletsWithBalances(supabase)` — fetches all wallets for the current user, calls `get_wallet_balance` for each, returns `WalletWithBalance[]`

### 2.7 TypeScript types (`types/database.ts`)

Add `WalletType`, `WalletRow`, `WalletInsert`, `WalletUpdate`, `WalletWithBalance` (extends `WalletRow` with `balance: number`).

### 2.8 Sidebar

Add **Wallets** nav item between Dashboard and Transactions in `components/layout/Sidebar.tsx`.

---

## 3. Transaction Form Changes — Web

### 3.1 Expense / Income

Add an optional **Wallet** dropdown (`wallet_id`) to `TransactionForm`. Populated with the user's wallets. Shows wallet name + type icon. Field is optional — existing transactions without a wallet still work.

### 3.2 Transfer

Replace the two free-text `from_account` / `to_account` inputs with two wallet dropdowns:
- **From wallet** (`from_wallet_id`) — required for transfers
- **To wallet** (`to_wallet_id`) — required for transfers, must differ from from_wallet

### 3.3 Server actions updated

`createTransaction` and `updateTransaction` in `lib/actions/transactions.ts` updated to:
- Accept `wallet_id`, `from_wallet_id`, `to_wallet_id` from formData
- Remove `from_account` / `to_account`
- Validate wallet ownership (wallet must belong to current user)
- Enforce updated transfer constraint

### 3.4 TransactionSchema updated (`lib/schemas/transaction.ts`)

Replace `from_account`/`to_account` strings with `from_wallet_id`/`to_wallet_id` UUID fields.

---

## 4. Onboarding Wizard — Web

### 4.1 Route: `/onboarding`

Standalone page — no dashboard layout (no sidebar, no topbar). Clean, focused UI.

### 4.2 Steps

**Step 1 — Welcome**  
Heading: "Let's set up your accounts". Brief explanation of what wallets are. Primary CTA: "Get started". Secondary: "Skip for now" (sets `onboarding_completed = true`, redirects to dashboard).

**Step 2 — Add wallets (repeating)**  
- User picks a wallet type from a visual type-picker (icons + labels)
- Fills in name, currency, opening balance (+ credit limit for credit_card)
- Clicks "Add wallet" → wallet card appears in a growing list below the form
- Can remove any added wallet
- "Continue" button (active after ≥ 1 wallet) + "Skip for now"

**Step 3 — Done**  
Summary list of added wallets. "Go to dashboard" button — calls `completeOnboarding` server action (sets `onboarding_completed = true`, creates all wallets from session state), then redirects to `/dashboard/wallets`.

### 4.3 Redirect logic (`proxy.ts`)

After session is validated for `/dashboard/*` routes: check `profiles.onboarding_completed`. If `false` and path is not `/onboarding`, redirect to `/onboarding`. Once completed or skipped, `onboarding_completed = true` prevents future redirects.

### 4.4 Server action: `completeOnboarding`

The wizard is a client component that accumulates wallets in React `useState`. On "Go to dashboard" the array is serialised as JSON and posted to `completeOnboarding` (a Server Action that accepts a plain JSON string argument, not FormData). The action bulk-inserts all wallets in one call, sets `onboarding_completed = true` on the profile, revalidates `/dashboard`.

---

## 5. Mobile

### 5.1 New tab: Wallets

Added to `(tabs)/_layout.tsx` between Transactions and Settings. Shows a scrollable list of wallet cards with computed balances (fetched via Supabase RPC call to `get_wallet_balance`).

### 5.2 Wallet screens

New route group `app/(wallets)/`:
- `_layout.tsx` — stack layout
- `index.tsx` — wallet list (same data as tab, or the tab IS this screen)
- `new.tsx` — create form
- `[id]/edit.tsx` — edit form

Delete via swipe action or button inside edit screen (Alert confirmation).

### 5.3 Transaction form changes (mobile)

- `transactions/new.tsx`: add wallet picker (modal bottom sheet or inline select) for `wallet_id` on expense/income; two wallet pickers for `from_wallet_id`/`to_wallet_id` on transfer
- `(review)/review.tsx`: same wallet picker added to the post-OCR confirmation form

### 5.4 Onboarding wizard (mobile)

New route group `app/(onboarding)/`:
- `index.tsx` — Welcome step
- `add-wallets.tsx` — Add wallets step (repeating form + growing list)
- `done.tsx` — Summary + "Go to dashboard"

Root `_layout.tsx` checks `onboarding_completed` on the profile after auth and routes to `(onboarding)` if false.

---

## 6. Migration Plan

| Migration file | Description |
|---|---|
| `007_wallets.sql` | Create `wallet_type` enum, `wallets` table, RLS, indexes |
| `007_wallets_down.sql` | Drop table, enum |
| `008_transactions_wallet_fk.sql` | Add `wallet_id`, `from_wallet_id`, `to_wallet_id`; drop `from_account`, `to_account`; update CHECK constraint; add `get_wallet_balance` function |
| `008_transactions_wallet_fk_down.sql` | Reverse: restore `from_account`/`to_account`, drop new columns and function |
| `009_onboarding_flag.sql` | Add `onboarding_completed` to `profiles` |
| `009_onboarding_flag_down.sql` | Drop column |

Migrations are applied in order. Because `from_account`/`to_account` currently contain no real user data (feature is new), dropping them is safe.

---

## 7. Out of Scope

- PSD2 bank sync (planned for Phase 3)
- Automatic currency conversion (balances shown in wallet's own currency)
- Multi-currency aggregation on the dashboard
- Historical balance chart per wallet
- Investment/crypto price feeds (balance is transaction-based, manually entered)
