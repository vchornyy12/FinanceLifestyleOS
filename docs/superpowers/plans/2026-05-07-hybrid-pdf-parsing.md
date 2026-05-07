# Hybrid PDF Parsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** For PDFs, attempt server-side text extraction first; if the extracted text is ≥ 150 characters, send it to Claude as plain text — otherwise fall back to Claude's native document API (current behaviour). Images and text/CSV files are unchanged.

**Architecture:** A new `extractPdfText(buffer)` helper in the OCR route tries `pdf-parse` inside a try/catch. The PDF branch of the route picks `buildReceiptTextMessage` or `buildReceiptDocumentMessage` based on the result. All failures fall back silently to the document path.

**Tech Stack:** `pdf-parse` v5 (Node.js), Vitest for unit tests, existing Next.js API route structure.

---

## File Map

| File | Action |
|------|--------|
| `apps/web/package.json` | Add `pdf-parse` + `@types/pdf-parse` dependencies |
| `apps/web/__tests__/api/receipts-parse.test.ts` | Add `pdf-parse` mock + 3 new tests |
| `apps/web/app/api/receipts/parse/route.ts` | Add `extractPdfText`, update PDF branch |

---

## Task 1: Install pdf-parse

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add the dependency**

Open `apps/web/package.json`. In the `"dependencies"` object, add these two lines (keep alphabetical order with existing deps):

```json
"@types/pdf-parse": "^1.1.4",
"pdf-parse": "^1.1.5",
```

`@types/pdf-parse` is a dev-only type package but Next.js builds work fine with it in `dependencies` — keep it there for simplicity.

- [ ] **Step 2: Install**

```bash
pnpm install
```

Expected: no errors, `pdf-parse` appears in `apps/web/node_modules`.

- [ ] **Step 3: Verify TypeScript is happy**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: exits 0 (no type errors). If it complains about `pdf-parse` types, the `@types/pdf-parse` package wasn't installed — re-run `pnpm install`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add pdf-parse for server-side PDF text extraction"
```

---

## Task 2: Add failing tests for the hybrid PDF logic

**Files:**
- Modify: `apps/web/__tests__/api/receipts-parse.test.ts`

The goal is to write tests that describe the new behaviour before implementing it. They must **fail** at the end of this task.

- [ ] **Step 1: Add the pdf-parse mock at the top of the test file**

Open `apps/web/__tests__/api/receipts-parse.test.ts`. After the existing `const mockFetch = vi.fn()` line (around line 38), add:

```ts
// Mock pdf-parse — controls what text extraction returns per test
const mockPdfParse = vi.fn()
vi.mock('pdf-parse', () => ({
  default: mockPdfParse,
}))
```

Make sure this block comes **before** the `const { POST } = await import(...)` line, otherwise the mock won't be in place when the module loads.

- [ ] **Step 2: Default the mock in setupHappyPath**

Inside the `setupHappyPath()` function, add a default for the PDF mock so existing tests continue to exercise the document-API fallback path (empty text → fallback):

```ts
// Default: pdf-parse returns no text (scanned PDF) → falls back to document API
mockPdfParse.mockResolvedValue({ text: '' })
```

The full updated `setupHappyPath` becomes:

```ts
function setupHappyPath() {
  mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })

  mockCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://storage.example.com/signed' },
    error: null,
  })

  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: async () => Buffer.from('fake-image-data'),
    headers: { get: () => 'image/jpeg' },
  })

  mockMessagesCreate.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(VALID_PARSED_RECEIPT) }],
    stop_reason: 'end_turn',
  })

  // Default: pdf-parse returns no text (scanned PDF) → falls back to document API
  mockPdfParse.mockResolvedValue({ text: '' })
}
```

> Note: also added `stop_reason: 'end_turn'` to the `mockMessagesCreate` return value — the route now reads `message.stop_reason` in the parse-error handler.

- [ ] **Step 3: Add the new describe block at the end of the test file**

Just before the final closing `})` of the top-level `describe('POST /api/receipts/parse', ...)`, add:

```ts
// -------------------------------------------------------------------------
// PDF hybrid logic
// -------------------------------------------------------------------------

describe('PDF hybrid logic', () => {
  it('sends text message to Claude when pdf-parse extracts ≥ 150 chars', async () => {
    setupHappyPath()
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('%PDF-1.4 fake'),
      headers: { get: () => 'application/pdf' },
    })
    // Return enough text to exceed the 150-char threshold
    const longText = 'Biedronka\n' + 'Chleb 3.49\n'.repeat(20) // ~230 chars
    mockPdfParse.mockResolvedValue({ text: longText })

    const req = makeRequest({
      authHeader: `Bearer ${VALID_TOKEN}`,
      body: { storagePath: `${VALID_USER_ID}/receipt.pdf` },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)

    // Verify Claude was called with a plain-text message (not a document block)
    const claudeCall = mockMessagesCreate.mock.calls[0][0]
    expect(claudeCall.messages[0].content[0].type).toBe('text')
    expect(claudeCall.messages[0].content[0].text).toContain(longText)
  })

  it('falls back to document message when pdf-parse returns text < 150 chars', async () => {
    setupHappyPath()
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('%PDF-1.4 fake'),
      headers: { get: () => 'application/pdf' },
    })
    mockPdfParse.mockResolvedValue({ text: 'short' }) // only 5 chars → below threshold

    const req = makeRequest({
      authHeader: `Bearer ${VALID_TOKEN}`,
      body: { storagePath: `${VALID_USER_ID}/receipt.pdf` },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)

    // Verify Claude was called with a document block (base64 PDF)
    const claudeCall = mockMessagesCreate.mock.calls[0][0]
    expect(claudeCall.messages[0].content[0].type).toBe('document')
  })

  it('falls back to document message when pdf-parse throws (encrypted / corrupt PDF)', async () => {
    setupHappyPath()
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('%PDF-1.4 fake'),
      headers: { get: () => 'application/pdf' },
    })
    mockPdfParse.mockRejectedValue(new Error('PDF is encrypted'))

    const req = makeRequest({
      authHeader: `Bearer ${VALID_TOKEN}`,
      body: { storagePath: `${VALID_USER_ID}/receipt.pdf` },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)

    // Even on error, Claude should still be called via the document path
    const claudeCall = mockMessagesCreate.mock.calls[0][0]
    expect(claudeCall.messages[0].content[0].type).toBe('document')
  })
})
```

- [ ] **Step 4: Run the new tests and confirm they fail**

```bash
pnpm --filter web exec vitest run __tests__/api/receipts-parse.test.ts
```

Expected: the 3 new tests under `PDF hybrid logic` fail (the route doesn't yet use `pdf-parse`). Existing tests should still pass.

---

## Task 3: Implement extractPdfText and update the PDF branch

**Files:**
- Modify: `apps/web/app/api/receipts/parse/route.ts`

- [ ] **Step 1: Add the extractPdfText helper**

Open `apps/web/app/api/receipts/parse/route.ts`. After the `isAllowedMimeType` function (around line 66), add:

```ts
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default
    const result = await pdfParse(Buffer.from(buffer))
    return result.text ?? ''
  } catch {
    return ''
  }
}
```

The dynamic import keeps `pdf-parse` out of any edge-runtime bundle. The try/catch ensures encrypted or corrupt PDFs silently return an empty string, triggering the document-API fallback.

- [ ] **Step 2: Update the PDF branch in the POST handler**

Find this block (around line 160–170):

```ts
let userMessage
if (isImageMime(mimeType)) {
  const imageBase64 = Buffer.from(imageBuffer).toString('base64')
  userMessage = buildReceiptUserMessage(imageBase64, mimeType)
} else if (mimeType === 'application/pdf') {
  const pdfBase64 = Buffer.from(imageBuffer).toString('base64')
  userMessage = buildReceiptDocumentMessage(pdfBase64)
} else {
  const text = Buffer.from(imageBuffer).toString('utf-8')
  userMessage = buildReceiptTextMessage(text)
}
```

Replace it with:

```ts
let userMessage
if (isImageMime(mimeType)) {
  const imageBase64 = Buffer.from(imageBuffer).toString('base64')
  userMessage = buildReceiptUserMessage(imageBase64, mimeType)
} else if (mimeType === 'application/pdf') {
  const extractedText = await extractPdfText(imageBuffer)
  if (extractedText.trim().length >= 150) {
    userMessage = buildReceiptTextMessage(extractedText)
  } else {
    const pdfBase64 = Buffer.from(imageBuffer).toString('base64')
    userMessage = buildReceiptDocumentMessage(pdfBase64)
  }
} else {
  const text = Buffer.from(imageBuffer).toString('utf-8')
  userMessage = buildReceiptTextMessage(text)
}
```

- [ ] **Step 3: Run the full unit test suite and confirm all tests pass**

```bash
pnpm --filter web exec vitest run __tests__/api/receipts-parse.test.ts
```

Expected: all tests pass, including the 3 new `PDF hybrid logic` tests.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/receipts/parse/route.ts \
        apps/web/__tests__/api/receipts-parse.test.ts
git commit -m "feat(ocr): hybrid PDF parsing — extract text first, fall back to document API"
```
