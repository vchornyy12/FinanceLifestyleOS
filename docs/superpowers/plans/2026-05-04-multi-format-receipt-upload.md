# Multi-Format Receipt Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to upload PDF (multi-page), TXT, and CSV receipts alongside existing JPEG/PNG/WebP on both web and mobile.

**Architecture:** The API route becomes a multi-modal router — after fetching the file from Supabase Storage it branches on MIME type, calling a different Claude message builder for images (existing), PDFs (Document API), and text (text message). Web and mobile clients are updated to accept the new file types; mobile adds a document picker entry point.

**Tech Stack:** Next.js 16, Anthropic SDK (`type: 'document'` for PDF), Zod, Expo + `expo-document-picker`

**Spec:** `docs/superpowers/specs/2026-05-04-multi-format-receipt-upload-design.md`

---

### Task 1: Extend prompt builders

**Files:**
- Modify: `apps/web/lib/ocr/parseReceiptPrompt.ts`

- [ ] Add two new exported functions and update the system prompt:

```ts
// append to RECEIPT_SYSTEM_PROMPT (before the closing backtick):
// - If input is CSV, the first row may be a header — skip it and parse data rows as items

export const buildReceiptDocumentMessage = (pdfBase64: string) => ({
  role: 'user' as const,
  content: [
    {
      type: 'document' as const,
      source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: pdfBase64 },
    },
    { type: 'text' as const, text: 'Parse this receipt and return JSON only.' },
  ],
})

export const buildReceiptTextMessage = (text: string) => ({
  role: 'user' as const,
  content: [{ type: 'text' as const, text: `Parse this receipt and return JSON only.\n\n${text}` }],
})
```

- [ ] Commit:
```bash
git add apps/web/lib/ocr/parseReceiptPrompt.ts
git commit -m "feat(ocr): add PDF and text message builders"
```

---

### Task 2: Update API route — MIME types, size guards, branching

**Files:**
- Modify: `apps/web/app/api/receipts/parse/route.ts`

- [ ] Write failing tests first in `apps/web/__tests__/api/receipts-parse.test.ts`:

```ts
// Add to existing test file — mock the storage fetch to return each new type
it('returns 400 for unsupported MIME type', async () => { /* mock .docx response */ })
it('returns 413 for PDF over 20 MB', async () => { /* mock large PDF */ })
it('returns 413 for text over 1 MB', async () => { /* mock large TXT */ })
it('parses PDF receipt successfully', async () => { /* mock application/pdf response */ })
it('parses TXT receipt successfully', async () => { /* mock text/plain response */ })
it('parses CSV receipt successfully', async () => { /* mock text/csv response */ })
```

Run: `pnpm --filter web exec vitest run __tests__/api/receipts-parse.test.ts`  
Expected: all new tests FAIL.

- [ ] Replace `ALLOWED_MIME_TYPES` and add the `isTextMime` helper:

```ts
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
type ImageMimeType = typeof IMAGE_MIME_TYPES[number]

const ALLOWED_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  'application/pdf',
  'text/plain',
  'text/csv',
] as const

function isImageMime(t: string): t is ImageMimeType {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(t)
}
function isAllowedMimeType(t: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(t)
}
```

- [ ] After `const rawMime = ...` (currently line 125), replace the fallback block with:

```ts
const mimeType = rawMime

if (!isAllowedMimeType(mimeType)) {
  console.error('[ocr] unsupported_mime: %s', mimeType)
  return NextResponse.json({ error: 'UNSUPPORTED_FILE_TYPE' }, { status: 400 })
}

const PDF_LIMIT = 20 * 1024 * 1024
const TEXT_LIMIT = 1 * 1024 * 1024
if (mimeType === 'application/pdf' && imageBuffer.byteLength > PDF_LIMIT) {
  return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 })
}
if ((mimeType === 'text/plain' || mimeType === 'text/csv') && imageBuffer.byteLength > TEXT_LIMIT) {
  return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 })
}
```

- [ ] Replace the `buildReceiptUserMessage(...)` call with the branching logic:

```ts
import {
  RECEIPT_SYSTEM_PROMPT,
  buildReceiptUserMessage,
  buildReceiptDocumentMessage,
  buildReceiptTextMessage,
} from '@/lib/ocr/parseReceiptPrompt'

// ...inside POST handler, replacing the single message builder call:
let userMessage
if (isImageMime(mimeType)) {
  userMessage = buildReceiptUserMessage(imageBase64, mimeType)
} else if (mimeType === 'application/pdf') {
  userMessage = buildReceiptDocumentMessage(imageBase64)
} else {
  const text = Buffer.from(imageBuffer).toString('utf-8')
  userMessage = buildReceiptTextMessage(text)
}

message = await getAnthropic().messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 2048,
  system: RECEIPT_SYSTEM_PROMPT,
  messages: [userMessage],
})
```

- [ ] Run tests: `pnpm --filter web exec vitest run __tests__/api/receipts-parse.test.ts`  
Expected: all pass.

- [ ] Commit:
```bash
git add apps/web/app/api/receipts/parse/route.ts
git commit -m "feat(api): support PDF, TXT, CSV in receipt parse route"
```

---

### Task 3: Update web uploader

**Files:**
- Modify: `apps/web/components/receipts/ReceiptUploader.tsx`

- [ ] Update validation, extension map, input accept, hint text, and error messages:

```ts
// Replace line 69 validation:
const ACCEPTED_MIME = /^(image\/(jpeg|png|webp)|application\/pdf|text\/(plain|csv))$/
if (!ACCEPTED_MIME.test(file.type)) {
  setError('Please upload a JPEG, PNG, WebP, PDF, TXT, or CSV file.')
  return
}

// Replace lines 89-95 extension derivation:
const EXT_MAP: Record<string, string> = {
  'image/png': 'png', 'image/webp': 'webp',
  'application/pdf': 'pdf', 'text/plain': 'txt', 'text/csv': 'csv',
}
const ext = EXT_MAP[file.type] ?? 'jpg'

// Replace <input accept>:
// accept="image/jpeg,image/png,image/webp,application/pdf,.pdf,text/plain,.txt,text/csv,.csv"

// Replace hint text:
// "JPEG, PNG, WebP, PDF, TXT or CSV"

// Add to error mapping (where body.error is checked):
// 'UNSUPPORTED_FILE_TYPE' → "This file type isn't supported. Upload a JPEG, PNG, WebP, PDF, TXT, or CSV."
// 'FILE_TOO_LARGE' → "File is too large. PDFs must be under 20 MB, text files under 1 MB."
```

- [ ] Commit:
```bash
git add apps/web/components/receipts/ReceiptUploader.tsx
git commit -m "feat(web): accept PDF, TXT, CSV in receipt uploader"
```

---

### Task 4: Mobile — add uploadReceiptFile

**Files:**
- Modify: `apps/mobile/lib/receiptUpload.ts`

- [ ] Add the new function at the end of the file:

```ts
const FILE_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
}

export async function uploadReceiptFile(
  uri: string,
  mimeType: string,
  userId: string,
): Promise<string> {
  const response = await fetch(uri)
  const blob = await response.blob()
  const ext = FILE_EXT[mimeType] ?? 'bin'
  const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('receipts')
    .upload(storagePath, blob, { contentType: mimeType })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return storagePath
}
```

- [ ] Commit:
```bash
git add apps/mobile/lib/receiptUpload.ts
git commit -m "feat(mobile): add uploadReceiptFile for non-image types"
```

---

### Task 5: Mobile — extend useReceiptPipeline

**Files:**
- Modify: `apps/mobile/hooks/useReceiptPipeline.ts`

- [ ] Add `runFromFile` to the hook (alongside existing `run`):

```ts
import { compressImage, uploadReceiptImage, uploadReceiptFile, parseReceipt } from '@/lib/receiptUpload'

// Inside useReceiptPipeline, add:
async function runFromFile(uri: string, mimeType: string): Promise<void> {
  if (!user) return
  setProcessing(true)
  try {
    const storagePath = await uploadReceiptFile(uri, mimeType, user.id)
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) throw new Error('NOT_AUTHENTICATED')
    const data = await parseReceipt(storagePath, accessToken)
    const lowConfCount = data.items.filter(i => i.confidence === 'low').length
    if (data.items.length > 0 && lowConfCount / data.items.length > 0.5) {
      await new Promise<void>((resolve) => {
        Alert.alert('Receipt may be unclear', 'More than half of the items have low confidence. Review carefully.', [{ text: 'Continue', onPress: () => resolve() }])
      })
    }
    router.push({ pathname: '/(review)/review', params: { receiptJson: JSON.stringify(data), storagePath } })
  } catch (err) {
    const code = err instanceof Error ? err.message : 'PARSE_FAILED'
    const messages: Record<string, string> = {
      UNAUTHENTICATED: 'Session expired. Please sign in again.',
      RATE_LIMITED: 'Too many requests. Please try again later.',
      TIMEOUT: 'Receipt parsing timed out. Please try again.',
      NOT_AUTHENTICATED: 'Session expired. Please sign in again.',
      FILE_TOO_LARGE: 'File is too large to process.',
      UNSUPPORTED_FILE_TYPE: 'This file type is not supported.',
    }
    Alert.alert('Error', messages[code] ?? 'Failed to process receipt. Please try again.')
  } finally {
    setProcessing(false)
  }
}

return { run, runFromFile, processing }
```

- [ ] Commit:
```bash
git add apps/mobile/hooks/useReceiptPipeline.ts
git commit -m "feat(mobile): add runFromFile to receipt pipeline"
```

---

### Task 6: Mobile — add document picker to home screen

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/package.json`

- [ ] Install the package:
```bash
pnpm --filter mobile add expo-document-picker
```

- [ ] Update `index.tsx`:

```ts
import * as DocumentPicker from 'expo-document-picker'
import { useReceiptPipeline } from '@/hooks/useReceiptPipeline'

// Update ACTION_OPTIONS and CANCEL_INDEX:
const ACTION_OPTIONS = ['Take Photo', 'Upload from Gallery', 'Upload Receipt Screenshot', 'Upload File (PDF, TXT, CSV)', 'Cancel']
const CANCEL_INDEX = 4

// Add handleFilePick inside HomeScreen:
const pipeline = useReceiptPipeline()

const handleFilePick = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'text/plain', 'text/csv'],
  })
  if (result.canceled) return
  const asset = result.assets[0]
  const mimeType = asset.mimeType ?? (
    asset.name.endsWith('.pdf') ? 'application/pdf' :
    asset.name.endsWith('.csv') ? 'text/csv' : 'text/plain'
  )
  pipeline.runFromFile(asset.uri, mimeType)
}

// Update ActionSheetIOS callback — add buttonIndex === 3 case:
if (buttonIndex === 3) handleFilePick()

// Update Android Alert options — add before Cancel:
{ text: ACTION_OPTIONS[3], onPress: handleFilePick },
```

- [ ] Commit:
```bash
git add apps/mobile/app/(tabs)/index.tsx apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): add Upload File option with expo-document-picker"
```

---

### Task 7: Manual smoke test

- [ ] **Web:** Start `pnpm --filter web dev`, go to `/dashboard/receipts/upload`, drag a `.pdf`, a `.txt`, and a `.csv` — confirm the review screen appears with parsed items for each.
- [ ] **Web edge cases:** Try uploading a `.docx` — confirm "This file type isn't supported" error appears.
- [ ] **Mobile:** Run `pnpm --filter mobile start`, open on iOS/Android simulator, tap `+` → "Upload File" — confirm document picker opens, pick each file type, confirm review screen appears.
- [ ] If everything passes, you're done.
