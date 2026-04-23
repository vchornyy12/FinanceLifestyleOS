# Category CRUD + Subcategories Design

**Date:** 2026-04-23  
**Scope:** Web app only (`apps/web`)

---

## Goal

Replace the read-only global system categories with a fully editable, per-user category tree. Every user gets 30 personal categories at signup (6 parents + 24 subcategories). Users can create, edit, and delete any category — including adding their own subcategories.

---

## Category Structure

6 parent categories seeded per user at signup. All user-owned (`user_id = auth.uid()`).

| Parent | Type | Color | Subcategories |
|--------|------|-------|---------------|
| Income | income | #10B981 | Salary, Bonus, Freelance, Other Income |
| Food & Dining | expense | #F97316 | Supermarket, Restaurant, Café, Takeaway |
| Housing & Bills | expense | #3B82F6 | Rent/Mortgage, Utilities, Internet & Phone, Home Maintenance |
| Transport | expense | #F59E0B | Fuel, Car Insurance, Car Maintenance, Public Transport |
| Finance | expense | #EF4444 | Credit Payment, Loan Repayment, Savings Transfer |
| Personal | expense | #8B5CF6 | Health & Medical, Shopping & Clothing, Entertainment, Education |

Subcategories inherit the parent's `type` and `color` as defaults but both can be overridden per subcategory.

---

## Data Model

### Schema changes (migration 006)

```sql
-- Add parent_id column
ALTER TABLE public.categories
  ADD COLUMN parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE;

CREATE INDEX idx_categories_parent_id ON public.categories(parent_id);
```

**Constraints:**
- `parent_id IS NULL` → top-level (parent) category
- `parent_id IS NOT NULL` → subcategory
- No deeper nesting — subcategories cannot have children (enforced in the server action: if the supplied `parent_id` itself has a non-null `parent_id`, the request is rejected with an error)
- `ON DELETE CASCADE` — deleting a parent deletes all its subcategories

### System category retirement

All existing system rows (`user_id IS NULL`) are deleted. Before deletion, any `transactions.category_id` references are remapped to the closest matching user-owned category by name. This is handled in the migration for existing users.

### Per-user seeding

A new PL/pgSQL function `seed_user_categories(user_id UUID)` creates all 30 rows. The existing `handle_new_user()` signup trigger calls this function after inserting the profile row.

### RLS simplification

The old policy that allowed reading `user_id IS NULL` rows is removed. New policy is simply `user_id = auth.uid()` for all operations (SELECT, INSERT, UPDATE, DELETE).

### TypeScript types

`CategoryRow` gains `parent_id: string | null`. `CategoryInsert` gains `parent_id?: string | null`.

---

## Web UI

### Categories page (`/dashboard/settings/categories`)

Single unified tree — the existing "System defaults / Your categories" two-section layout is replaced.

**Layout:**
```
▶  Income           [income]   [+ Subcategory]  [Edit]  [Delete]
▶  Food & Dining    [expense]  [+ Subcategory]  [Edit]  [Delete]
   ▼  (expanded)
      Supermarket                               [Edit]  [Delete]
      Restaurant                               [Edit]  [Delete]
      Café                                     [Edit]  [Delete]
      Takeaway                                 [Edit]  [Delete]
▶  Housing & Bills  [expense]  [+ Subcategory]  [Edit]  [Delete]
▶  Transport        [expense]  [+ Subcategory]  [Edit]  [Delete]
▶  Finance          [expense]  [+ Subcategory]  [Edit]  [Delete]
▶  Personal         [expense]  [+ Subcategory]  [Edit]  [Delete]

                                              [+ Add category]
```

- Parents are collapsed by default; click row or arrow to expand
- "Edit" opens the inline `CategoryForm` below the row (existing pattern)
- "Delete" triggers the existing reassignment prompt if transactions exist
- "+ Subcategory" opens `CategoryForm` pre-set to that parent
- "+ Add category" at the bottom creates a new top-level category

**Subcategory rows are indented** and show no expand arrow. They have Edit + Delete only (no "+ Subcategory" — no deeper nesting).

### CategoryForm changes

- Gains an optional `parentId` prop / hidden input
- When `parentId` is set: type and color default to the parent's values; no parent selector shown
- When `parentId` is null (top-level): type radio + color picker shown as today; optionally show a parent selector to create as subcategory

### Transaction form category picker

`<select>` uses `<optgroup>` for parent categories (not selectable themselves) and `<option>` for subcategories. Only parents with matching type (or `any`) are shown along with their children.

```html
<optgroup label="Income">
  <option>Salary</option>
  <option>Bonus</option>
</optgroup>
<optgroup label="Food & Dining">
  <option>Supermarket</option>
  <option>Restaurant</option>
</optgroup>
```

Parent categories are not selectable — only subcategories appear as options. If a parent has no subcategories, the parent itself is selectable as a fallback.

---

## Server Actions

### `createCategory`

Add `parent_id` to the Zod schema (optional UUID or null). Enforce no-deeper-nesting: if the supplied `parent_id` itself has a `parent_id`, reject with an error.

### `updateCategory`

Add `parent_id` to the update payload. Same nesting guard.

### `deleteCategory`

No change to the reassignment logic. Deleting a parent cascades to subcategories at the DB level — the action should warn the user how many subcategories will also be deleted.

---

## Data Queries

### Categories page

Fetch all user categories in one query, ordered by `parent_id NULLS FIRST, name`. Build the parent→children map in the component (simple object grouping — 30 rows max).

### Transaction form

Same flat fetch; the `<optgroup>` structure is built from parent_id grouping.

---

## Migration Strategy for Existing Users

1. For each existing user, call `seed_user_categories(user_id)` — but only if they have no user-owned categories yet.
2. For each transaction referencing a system category, update `category_id` to the best-match new category (match by lowercased name prefix, fallback to the appropriate parent).
3. Delete all system categories (`user_id IS NULL`).

---

## Out of Scope

- Mobile category management UI (separate feature)
- Drag-and-drop reordering
- Category icons / emoji
- More than two levels of nesting
- Bulk operations
