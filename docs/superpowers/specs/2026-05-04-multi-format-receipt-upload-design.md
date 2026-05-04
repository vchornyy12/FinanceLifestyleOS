# Multi-Format Receipt Upload

**Date:** 2026-05-04  
**Status:** Approved  
**Scope:** Web (Next.js) + Mobile (Expo)

## Problem

The receipt OCR pipeline currently accepts only image files (JPEG, PNG, WebP). Users want to upload PDFs (including multi-page), plain-text email confirmations, and CSV exports from POS systems.

## Approach

Use Claude's built-in multi-modal capabilities — no new server-side conversion libraries:

- **JPEG / PNG / WebP** → existing Vision API path (unchanged)
- **PDF (multi-page)** → Claude Document API (`type: 'document'`, `media_type: 'application/pdf'`)
- **TXT / CSV** → plain text message (`type: 'text'`)

All paths converge on the same `ParsedReceiptSchema` Zod validation and the same review flow.

## Architecture

```
Client → upload any type → Supabase Storage (receipts/ bucket)
Client → POST { storagePath } → API route
API route:
  fetch file via signed URL
  detect MIME type
  ├── image/*         → base64 → buildReceiptUserMessage()     (existing)
  ├── application/pdf → base64 → buildReceiptDocumentMessage() (new)
  └── text/plain|csv  → UTF-8  → buildReceiptTextMessage()     (new)
  → Claude → JSON → ParsedReceiptSchema → response
```

**What does not change:** auth, rate limiting (20 req/hr), storage path pattern (`{userId}/{uuid}.ext`), `ParsedReceiptSchema`, web review UI, mobile review screen, save-receipt action.

## File Size Guards

| Type | Limit | Rationale |
|---|---|---|
| Images | No change | Mobile compresses to ~2 MB |
| PDF | 20 MB | Claude supports 32 MB; 20 MB is a conservative cap |
| TXT / CSV | 1 MB | Text receipts are tiny; large files signal wrong input |

Requests exceeding limits return `413 FILE_TOO_LARGE`.

## Changes

### 1. `apps/web/app/api/receipts/parse/route.ts`

- Expand `ALLOWED_MIME_TYPES` to include `application/pdf`, `text/plain`, `text/csv`.
- Add size guard after file fetch (PDF > 20 MB or text > 1 MB → 413).
- Replace the silent MIME fallback (line 126) with an explicit `400 UNSUPPORTED_FILE_TYPE` error.
- Branch before the Claude call:
  - `image/*` → `buildReceiptUserMessage(base64, mime)` (existing)
  - `application/pdf` → `buildReceiptDocumentMessage(base64)` (new)
  - `text/*` → decode buffer as UTF-8, call `buildReceiptTextMessage(text)` (new)

### 2. `apps/web/lib/ocr/parseReceiptPrompt.ts`

Add two new exported functions:

**`buildReceiptDocumentMessage(pdfBase64: string)`**
```ts
{
  role: 'user',
  content: [
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
    { type: 'text', text: 'Parse this receipt and return JSON only.' }
  ]
}
```

**`buildReceiptTextMessage(text: string)`**
```ts
{
  role: 'user',
  content: [
    { type: 'text', text: `Parse this receipt and return JSON only.\n\n${text}` }
  ]
}
```

Append one rule to `RECEIPT_SYSTEM_PROMPT`:
```
- If input is CSV, the first row may be a header — skip it and parse data rows as items
```

### 3. `apps/web/components/receipts/ReceiptUploader.tsx`

- Update file validation regex to accept `application/pdf`, `text/plain`, `text/csv`.
- Extend the extension-from-MIME map: `application/pdf → pdf`, `text/plain → txt`, `text/csv → csv`.
- Update `<input accept>` to `"image/jpeg,image/png,image/webp,application/pdf,.pdf,text/plain,.txt,text/csv,.csv"`.
- Update hint text to `"JPEG, PNG, WebP, PDF, TXT or CSV"`.
- Map new API error codes to user-facing messages:
  - `UNSUPPORTED_FILE_TYPE` → `"This file type isn't supported. Upload a JPEG, PNG, WebP, PDF, TXT, or CSV."`
  - `FILE_TOO_LARGE` → `"File is too large. PDFs must be under 20 MB, text files under 1 MB."`

### 4. `apps/mobile/lib/receiptUpload.ts`

Add `uploadReceiptFile(uri: string, mimeType: string, userId: string): Promise<string>`:
- Fetches blob from URI (no compression).
- Derives extension from mimeType (`application/pdf → pdf`, `text/plain → txt`, `text/csv → csv`).
- Uploads to `receipts/{userId}/{uuid}.{ext}` with correct `contentType`.
- Returns `storagePath`.

### 5. `apps/mobile/hooks/useReceiptPipeline.ts`

Add `runFromFile(uri: string, mimeType: string): Promise<void>` to the existing hook:
- Skips `compressImage`.
- Calls `uploadReceiptFile(uri, mimeType, user.id)`.
- Calls `parseReceipt(storagePath, accessToken)`.
- Navigates to the review screen — identical to the existing `run()` tail.
- Reuses the existing `processing` state and error alert logic.

### 6. `apps/mobile/app/(tabs)/index.tsx`

- Add `"Upload File (PDF, TXT, CSV)"` to `ACTION_OPTIONS` (index 3, before Cancel).
- Update `CANCEL_INDEX` from 3 to 4.
- Add `handleFilePick()`:
  - Calls `DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain', 'text/csv'] })`.
  - On success, derives `mimeType` from `result.assets[0].mimeType` if non-null, otherwise falls back to file extension (`.pdf → application/pdf`, `.txt → text/plain`, `.csv → text/csv`).
  - Calls `pipeline.runFromFile(result.assets[0].uri, mimeType)`.
- Wire into both the iOS `ActionSheetIOS` callback and the Android `Alert` options.

### 7. `apps/mobile/package.json`

Add `expo-document-picker` (Expo SDK 52 compatible version).

## Error Codes (API)

| Code | HTTP | Meaning |
|---|---|---|
| `UNSUPPORTED_FILE_TYPE` | 400 | MIME type not in allowed list |
| `FILE_TOO_LARGE` | 413 | PDF > 20 MB or text > 1 MB |
| Existing codes | unchanged | `UNAUTHENTICATED`, `RATE_LIMITED`, `PARSE_FAILED`, etc. |

## Testing

- Unit: extend `__tests__/api/receipts-parse.test.ts` with cases for PDF, TXT, CSV inputs and the new error codes.
- Manual web: drag-and-drop a PDF, a `.txt` file, and a `.csv` file; confirm review screen appears correctly.
- Manual mobile: use "Upload File" action sheet option to pick each type; confirm review screen.
- Edge cases: PDF > 20 MB, CSV with header row, unsupported type (e.g., `.docx`).
