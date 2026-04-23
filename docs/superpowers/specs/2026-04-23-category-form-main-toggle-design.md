# Category Form — Main Category Toggle Design

**Date:** 2026-04-23
**Scope:** Web app only (`apps/web`)

---

## Goal

Replace the current split create/subcategory flows with a single unified `CategoryForm` that uses a "Main category" checkbox to switch between two modes: creating a standalone top-level category, or creating a subcategory assigned to an existing main category.

---

## Behaviour

### "Main category" checkbox — checked (default for new categories)

- Shows: **Name**, **Type** (radio), **Color** (picker)
- Hides: parent radio list
- Submits with `parent_id = null` (top-level category)

### "Main category" checkbox — unchecked

- Shows: **Name**, radio list of existing main categories (each row: color dot + name + type badge)
- Hides: Type radio, Color picker
- The selected parent's `type` and `color` are submitted as hidden inputs (inherited)
- Submits with `parent_id = <selected parent id>`
- A parent **must** be selected before the form can be submitted (required validation)

---

## Props

```tsx
interface CategoryFormProps {
  /** Editing an existing category. Drives default checkbox state and pre-selected parent. */
  category?: Category
  /** Full list of top-level categories (parent_id = null) for the parent radio list. */
  mainCategories: Category[]
  /** Pre-selects a parent in the radio list and unchecks the Main category checkbox.
   *  Used by the "+ Sub" button on ParentRow. */
  defaultParentId?: string
  onCancel: () => void
}
```

### Default checkbox state

| Scenario | `isMain` default |
|---|---|
| New category, no `defaultParentId` | `true` (checked) |
| New subcategory, `defaultParentId` provided | `false` (unchecked) |
| Editing a top-level category (`category.parent_id === null`) | `true` (checked) |
| Editing a subcategory (`category.parent_id !== null`) | `false` (unchecked) |

---

## Type & Color when unchecked

Subcategories inherit the selected parent's `type` and `color`. These values are submitted via hidden `<input>` elements so the server action receives them unchanged. If no parent is selected yet, the hidden inputs are empty and the server action's Zod validation will reject the form (type is required).

---

## CategoryList changes

`CategoryList` already receives `tree: CategoryWithChildren[]`. It derives the main categories list inline:

```tsx
const mainCategories: Category[] = tree.map(({ children: _c, ...parent }) => parent)
```

This list is passed as the `mainCategories` prop to every `CategoryForm` rendered by `CategoryList`.

The `+ Sub` button on `ParentRow` passes `defaultParentId={parent.id}` to `CategoryForm` instead of the old `parentCategory` prop. The `parentCategory` prop is removed entirely.

---

## Form heading

| State | Heading |
|---|---|
| Creating, main | "New category" |
| Creating, subcategory, parent selected | "New subcategory under \"{parent name}\""  |
| Creating, subcategory, no parent yet | "New subcategory" |
| Editing, main | "Edit category" |
| Editing, subcategory | "Edit subcategory" |

---

## Parent radio list

Each row:

```
● [color dot]  Income          [income badge]
○ [color dot]  Food & Dining   [expense badge]
○ [color dot]  Transport       [expense badge]
```

- Rendered as `<label>` wrapping a radio `<input name="parent_id">` — no extra state needed; native radio group tracks selection
- The currently selected parent's `type` and `color` are read from `mainCategories` array and written to hidden inputs
- If `defaultParentId` is set, the matching radio is pre-checked via `defaultChecked`

---

## No server action changes

The existing `createCategory` and `updateCategory` server actions already accept `parent_id`, `type`, and `color` from `FormData`. No changes needed.

---

## Files

| Action | File |
|---|---|
| Modify | `apps/web/components/categories/CategoryForm.tsx` |
| Modify | `apps/web/components/categories/CategoryList.tsx` |

---

## Out of scope

- Mobile UI
- Changing the `+ Sub` button label or position
- Allowing color/type override on subcategories (always inherited from parent)
- Inline subcategory creation in the same form submit (one category per submit)
