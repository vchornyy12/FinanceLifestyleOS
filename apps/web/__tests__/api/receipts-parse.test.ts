/**
 * Unit tests for POST /api/receipts/parse (thin job-creator)
 *
 * The route no longer does OCR — it creates a receipt_parse_jobs row and
 * triggers the background function. OCR tests live in __tests__/netlify/ocr-process.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
process.env.ANTHROPIC_API_KEY ??= 'test-anthropic-key'
process.env.URL ??= 'http://localhost:8888'

const mockGetUser = vi.fn()
const mockJobInsert = vi.fn()
let capturedJobInsert: Record<string, unknown> | null = null

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === 'receipt_parse_jobs') {
        return {
          insert: (row: Record<string, unknown>) => {
            capturedJobInsert = row
            return { select: () => ({ single: mockJobInsert }) }
          },
        }
      }
      return {}
    },
  }),
}))

// fetch is used only to trigger the background function
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const { POST } = await import('@/app/api/receipts/parse/route')

const VALID_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const VALID_TOKEN = 'valid-token'
const VALID_JOB_ID = 'job-uuid-111'

function makeRequest(opts: { authHeader?: string; body?: unknown }): Request {
  return new Request('http://localhost/api/receipts/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.authHeader ? { authorization: opts.authHeader } : {}),
    },
    body: JSON.stringify(opts.body ?? {}),
  })
}

function setupHappyPath() {
  mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })
  mockJobInsert.mockResolvedValue({ data: { id: VALID_JOB_ID }, error: null })
  mockFetch.mockResolvedValue(new Response(null, { status: 202 }))
}

describe('POST /api/receipts/parse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedJobInsert = null
  })

  describe('authentication', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await POST(makeRequest({ body: { storagePath: `${VALID_USER_ID}/r.jpg` } }) as never)
      expect(res.status).toBe(401)
      expect((await res.json()).error).toBe('UNAUTHENTICATED')
    })

    it('returns 401 when Authorization header lacks Bearer prefix', async () => {
      const res = await POST(makeRequest({ authHeader: 'Token t', body: { storagePath: `${VALID_USER_ID}/r.jpg` } }) as never)
      expect(res.status).toBe(401)
      expect((await res.json()).error).toBe('UNAUTHENTICATED')
    })

    it('returns 401 when token is invalid', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid jwt') })
      const res = await POST(makeRequest({ authHeader: 'Bearer bad', body: { storagePath: `${VALID_USER_ID}/r.jpg` } }) as never)
      expect(res.status).toBe(401)
    })
  })

  describe('rate limiting', () => {
    it('returns 429 after 20 requests from the same user', async () => {
      setupHappyPath()
      const uid = `rate-limit-${Date.now()}`
      mockGetUser.mockResolvedValue({ data: { user: { id: uid } }, error: null })
      for (let i = 0; i < 20; i++) {
        await POST(makeRequest({ authHeader: `Bearer ${VALID_TOKEN}`, body: { storagePath: `${uid}/r${i}.jpg` } }) as never)
      }
      const res = await POST(makeRequest({ authHeader: `Bearer ${VALID_TOKEN}`, body: { storagePath: `${uid}/r21.jpg` } }) as never)
      expect(res.status).toBe(429)
      expect((await res.json()).error).toBe('RATE_LIMITED')
    })
  })

  describe('input validation', () => {
    it('returns 400 when storagePath is missing', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })
      const res = await POST(makeRequest({ authHeader: `Bearer ${VALID_TOKEN}`, body: {} }) as never)
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('INVALID_REQUEST')
    })

    it('returns 400 when storagePath is empty string', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })
      const res = await POST(makeRequest({ authHeader: `Bearer ${VALID_TOKEN}`, body: { storagePath: '' } }) as never)
      expect(res.status).toBe(400)
    })
  })

  describe('path traversal prevention', () => {
    it('returns 403 when path does not start with user id', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })
      const res = await POST(makeRequest({ authHeader: `Bearer ${VALID_TOKEN}`, body: { storagePath: 'other-user/r.jpg' } }) as never)
      expect(res.status).toBe(403)
      expect((await res.json()).error).toBe('FORBIDDEN')
    })
  })

  describe('happy path', () => {
    it('returns 202 with jobId', async () => {
      setupHappyPath()
      const res = await POST(makeRequest({ authHeader: `Bearer ${VALID_TOKEN}`, body: { storagePath: `${VALID_USER_ID}/r.jpg` } }) as never)
      expect(res.status).toBe(202)
      const body = await res.json()
      expect(body.jobId).toBe(VALID_JOB_ID)
    })

    it('stores auto_save=true on the job when requested', async () => {
      setupHappyPath()
      const res = await POST(makeRequest({ authHeader: `Bearer ${VALID_TOKEN}`, body: { storagePath: `${VALID_USER_ID}/r.jpg`, autoSave: true } }) as never)
      expect(res.status).toBe(202)
      expect(capturedJobInsert).toMatchObject({ auto_save: true })
    })

    it('defaults auto_save to false when not sent', async () => {
      setupHappyPath()
      const res = await POST(makeRequest({ authHeader: `Bearer ${VALID_TOKEN}`, body: { storagePath: `${VALID_USER_ID}/r.jpg` } }) as never)
      expect(res.status).toBe(202)
      expect(capturedJobInsert).toMatchObject({ auto_save: false })
    })

    it('triggers the background function', async () => {
      setupHappyPath()
      await POST(makeRequest({ authHeader: `Bearer ${VALID_TOKEN}`, body: { storagePath: `${VALID_USER_ID}/r.jpg` } }) as never)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/.netlify/functions/ocr-process'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('error handling', () => {
    it('returns 500 when job insert fails', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })
      mockJobInsert.mockResolvedValue({ data: null, error: new Error('db error') })
      const res = await POST(makeRequest({ authHeader: `Bearer ${VALID_TOKEN}`, body: { storagePath: `${VALID_USER_ID}/r.jpg` } }) as never)
      expect(res.status).toBe(500)
      expect((await res.json()).error).toBe('PARSE_FAILED')
    })
  })
})
