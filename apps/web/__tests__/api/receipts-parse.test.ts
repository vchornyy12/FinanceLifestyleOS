/**
 * Unit tests for POST /api/receipts/parse
 *
 * Mocks: @anthropic-ai/sdk, @supabase/supabase-js
 * Does NOT hit real network or storage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn()
const mockCreateSignedUrl = vi.fn()
const mockMessagesCreate = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) },
  }),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockMessagesCreate }
  },
}))

// Mock global fetch used to download the receipt image
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ---------------------------------------------------------------------------
// Module under test (imported after mocks)
// ---------------------------------------------------------------------------

const { POST } = await import('@/app/api/receipts/parse/route')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(opts: {
  authHeader?: string
  body?: unknown
}): Request {
  return new Request('http://localhost/api/receipts/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.authHeader ? { authorization: opts.authHeader } : {}),
    },
    body: JSON.stringify(opts.body ?? {}),
  })
}

const VALID_USER_ID = 'user-abc-123'
const VALID_TOKEN = 'valid-token'

const VALID_PARSED_RECEIPT = {
  store: 'Biedronka',
  date: '2026-04-01',
  items: [
    { id: '1', name: 'Chleb', quantity: 1, unit_price: 3.49, total_price: 3.49, category: 'Food', confidence: 'high' },
  ],
  total: 3.49,
  confidence: 'high',
}

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
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/receipts/parse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe('authentication', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const req = makeRequest({ body: { storagePath: `${VALID_USER_ID}/receipt.jpg` } })
      const res = await POST(req as never)
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('UNAUTHENTICATED')
    })

    it('returns 401 when Authorization header lacks Bearer prefix', async () => {
      const req = makeRequest({
        authHeader: 'Token some-token',
        body: { storagePath: `${VALID_USER_ID}/receipt.jpg` },
      })
      const res = await POST(req as never)
      expect(res.status).toBe(401)
      expect((await res.json()).error).toBe('UNAUTHENTICATED')
    })

    it('returns 401 when Supabase cannot resolve the token to a user', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid jwt') })

      const req = makeRequest({
        authHeader: 'Bearer invalid-token',
        body: { storagePath: `${VALID_USER_ID}/receipt.jpg` },
      })
      const res = await POST(req as never)
      expect(res.status).toBe(401)
      expect((await res.json()).error).toBe('UNAUTHENTICATED')
    })
  })

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------

  describe('rate limiting', () => {
    it('returns 429 after 20 requests from the same user', async () => {
      // First 20 should succeed (reach Claude)
      setupHappyPath()
      const uniqueUserId = `rate-limit-test-${Date.now()}`
      mockGetUser.mockResolvedValue({ data: { user: { id: uniqueUserId } }, error: null })

      for (let i = 0; i < 20; i++) {
        const req = makeRequest({
          authHeader: `Bearer ${VALID_TOKEN}`,
          body: { storagePath: `${uniqueUserId}/r${i}.jpg` },
        })
        await POST(req as never)
      }

      // 21st request should be rate-limited
      const req = makeRequest({
        authHeader: `Bearer ${VALID_TOKEN}`,
        body: { storagePath: `${uniqueUserId}/r21.jpg` },
      })
      const res = await POST(req as never)
      expect(res.status).toBe(429)
      expect((await res.json()).error).toBe('RATE_LIMITED')
    })
  })

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe('input validation', () => {
    it('returns 400 when request body is missing storagePath', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })

      const req = makeRequest({
        authHeader: `Bearer ${VALID_TOKEN}`,
        body: {},
      })
      const res = await POST(req as never)
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('INVALID_REQUEST')
    })

    it('returns 400 when storagePath is an empty string', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })

      const req = makeRequest({
        authHeader: `Bearer ${VALID_TOKEN}`,
        body: { storagePath: '' },
      })
      const res = await POST(req as never)
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('INVALID_REQUEST')
    })
  })

  // -------------------------------------------------------------------------
  // Path traversal prevention
  // -------------------------------------------------------------------------

  describe('path traversal prevention', () => {
    it('returns 403 when storagePath does not start with the user ID', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })

      const req = makeRequest({
        authHeader: `Bearer ${VALID_TOKEN}`,
        body: { storagePath: 'other-user-id/malicious.jpg' },
      })
      const res = await POST(req as never)
      expect(res.status).toBe(403)
      expect((await res.json()).error).toBe('FORBIDDEN')
    })

    it('returns 403 for path traversal attempt with ../', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })

      const req = makeRequest({
        authHeader: `Bearer ${VALID_TOKEN}`,
        body: { storagePath: `../../../etc/passwd` },
      })
      const res = await POST(req as never)
      expect(res.status).toBe(403)
      expect((await res.json()).error).toBe('FORBIDDEN')
    })
  })

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe('successful parse', () => {
    it('returns 200 with parsed receipt data on valid request', async () => {
      setupHappyPath()

      const req = makeRequest({
        authHeader: `Bearer ${VALID_TOKEN}`,
        body: { storagePath: `${VALID_USER_ID}/receipt.jpg` },
      })
      const res = await POST(req as never)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.store).toBe('Biedronka')
      expect(Array.isArray(body.items)).toBe(true)
      expect(body.items).toHaveLength(1)
    })

    it('sets discrepancy_warning when items sum does not match total', async () => {
      setupHappyPath()
      // Override Claude response: items sum to 6.98 but total is 5.00 → discrepancy
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...VALID_PARSED_RECEIPT,
              items: [
                { ...VALID_PARSED_RECEIPT.items[0], total_price: 3.49 },
                { id: '2', name: 'Masło', quantity: 1, unit_price: 3.49, total_price: 3.49, category: 'Food', confidence: 'high' },
              ],
              total: 5.00,
            }),
          },
        ],
      })

      const req = makeRequest({
        authHeader: `Bearer ${VALID_TOKEN}`,
        body: { storagePath: `${VALID_USER_ID}/receipt.jpg` },
      })
      const res = await POST(req as never)
      expect(res.status).toBe(200)
      expect((await res.json()).discrepancy_warning).toBe(true)
    })

    it('returns 422 when Claude returns an error object (unreadable receipt)', async () => {
      setupHappyPath()
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ error: 'NO_ITEMS_FOUND' }) }],
      })

      const req = makeRequest({
        authHeader: `Bearer ${VALID_TOKEN}`,
        body: { storagePath: `${VALID_USER_ID}/receipt.jpg` },
      })
      const res = await POST(req as never)
      expect(res.status).toBe(422)
      expect((await res.json()).error).toBe('NO_ITEMS_FOUND')
    })
  })

  // -------------------------------------------------------------------------
  // Storage / upstream errors
  // -------------------------------------------------------------------------

  describe('upstream error handling', () => {
    it('returns 500 when signed URL creation fails', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })
      mockCreateSignedUrl.mockResolvedValue({ data: null, error: new Error('storage error') })

      const req = makeRequest({
        authHeader: `Bearer ${VALID_TOKEN}`,
        body: { storagePath: `${VALID_USER_ID}/receipt.jpg` },
      })
      const res = await POST(req as never)
      expect(res.status).toBe(500)
      expect((await res.json()).error).toBe('PARSE_FAILED')
    })

    it('returns 500 when Claude returns malformed JSON', async () => {
      setupHappyPath()
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'not-json{{{' }],
      })

      const req = makeRequest({
        authHeader: `Bearer ${VALID_TOKEN}`,
        body: { storagePath: `${VALID_USER_ID}/receipt.jpg` },
      })
      const res = await POST(req as never)
      expect(res.status).toBe(500)
      expect((await res.json()).error).toBe('PARSE_FAILED')
    })

    it('returns 504 when fetch times out', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })
      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://storage.example.com/signed' },
        error: null,
      })
      const timeoutError = new Error('The operation was aborted')
      timeoutError.name = 'TimeoutError'
      mockFetch.mockRejectedValue(timeoutError)

      const req = makeRequest({
        authHeader: `Bearer ${VALID_TOKEN}`,
        body: { storagePath: `${VALID_USER_ID}/receipt.jpg` },
      })
      const res = await POST(req as never)
      expect(res.status).toBe(504)
      expect((await res.json()).error).toBe('TIMEOUT')
    })
  })
})
