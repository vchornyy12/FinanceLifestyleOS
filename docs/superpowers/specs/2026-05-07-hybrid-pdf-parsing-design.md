# Hybrid PDF Parsing for OCR Route

**Date:** 2026-05-07  
**Status:** Approved

## Problem

The OCR route currently sends all PDFs to Claude via the document API (base64-encoded). This works but is suboptimal for text-based PDFs (e-receipts exported from store apps), where the text is already machine-readable and sending it as plain text is cheaper and faster. Scanned PDFs (photos wrapped in a PDF container) still require the document API.

## Solution

Server-side text extraction with a fallback. For every incoming PDF:

1. Attempt text extraction with `pdf-parse`.
2. If the extracted text is ≥ 150 characters (trimmed), send it to Claude as plain text via `buildReceiptTextMessage`.
3. Otherwise (scanned PDF, encrypted PDF, extraction error, or sparse text), fall back to the existing `buildReceiptDocumentMessage` with the raw PDF bytes.

Images and text/CSV files are unaffected.

## Architecture

### New dependency

`pdf-parse` + `@types/pdf-parse` added to `apps/web`. Pure Node.js, no native bindings, works in the existing Next.js API route (Node.js runtime).

### Helper function

```ts
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default
  const result = await pdfParse(Buffer.from(buffer))
  return result.text ?? ''
}
```

Dynamic import keeps the module out of the edge-runtime bundle (the route runs in Node.js, not at the edge, so this is fine).

### Modified PDF branch in `route.ts`

```
application/pdf
  └─ extractPdfText(imageBuffer)
       ├─ text.trim().length >= 150 → buildReceiptTextMessage(text)
       └─ else (scanned / error / sparse) → buildReceiptDocumentMessage(pdfBase64)
```

All other branches (image, text/plain, text/csv) are unchanged.

### Error handling

`extractPdfText` is wrapped in try/catch inside the PDF branch. Any error (encrypted PDF, malformed file, timeout) silently falls back to the document API. No new error surfaces to the client.

## Files Changed

| File | Change |
|------|--------|
| `apps/web/package.json` | Add `pdf-parse`, `@types/pdf-parse` |
| `apps/web/app/api/receipts/parse/route.ts` | Add `extractPdfText`, update PDF branch |

## Out of Scope

- Mobile app (calls the same web route — benefits automatically)
- Prompt, schema, enrichment pipeline, client UI
- Threshold tuning (150 chars is conservative; can be adjusted later without a spec change)
