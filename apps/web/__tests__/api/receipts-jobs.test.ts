import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'

const mockGetUser = vi.fn()
const mockJobFetch = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockJobFetch,
        }),
      }),
    }),
  }),
}))

const { GET } = await import('@/app/api/receipts/jobs/[id]/route')

const VALID_USER_ID = 'user-abc-123'
const VALID_JOB_ID = 'job-uuid-111'

function makeRequest(authHeader?: string): Request {
  return new Request(`http://localhost/api/receipts/jobs/${VALID_JOB_ID}`, {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

function makeParams() {
  return { params: Promise.resolve({ id: VALID_JOB_ID }) }
}

describe('GET /api/receipts/jobs/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when Authorization header is missing', async () => {
    const res = await GET(makeRequest() as never, makeParams() as never)
    expect(res.status).toBe(401)
  })

  it('returns 401 for invalid token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') })
    const res = await GET(makeRequest('Bearer bad') as never, makeParams() as never)
    expect(res.status).toBe(401)
  })

  it('returns 404 when job does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })
    mockJobFetch.mockResolvedValue({ data: null, error: new Error('not found') })
    const res = await GET(makeRequest('Bearer t') as never, makeParams() as never)
    expect(res.status).toBe(404)
  })

  it('returns 403 when job belongs to another user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })
    mockJobFetch.mockResolvedValue({
      data: { id: VALID_JOB_ID, user_id: 'other-user', status: 'done', result: null, error_code: null },
      error: null,
    })
    const res = await GET(makeRequest('Bearer t') as never, makeParams() as never)
    expect(res.status).toBe(403)
  })

  it('returns pending status', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })
    mockJobFetch.mockResolvedValue({
      data: { id: VALID_JOB_ID, user_id: VALID_USER_ID, status: 'pending', result: null, error_code: null },
      error: null,
    })
    const res = await GET(makeRequest('Bearer t') as never, makeParams() as never)
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('pending')
  })

  it('returns done status with result', async () => {
    const mockResult = { store: 'Biedronka', items: [], total: 10.00, date: '2026-04-01', confidence: 'high' }
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })
    mockJobFetch.mockResolvedValue({
      data: { id: VALID_JOB_ID, user_id: VALID_USER_ID, status: 'done', result: mockResult, error_code: null },
      error: null,
    })
    const res = await GET(makeRequest('Bearer t') as never, makeParams() as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('done')
    expect(body.result.store).toBe('Biedronka')
  })

  it('returns error status with errorCode', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })
    mockJobFetch.mockResolvedValue({
      data: { id: VALID_JOB_ID, user_id: VALID_USER_ID, status: 'error', result: null, error_code: 'NO_ITEMS_FOUND' },
      error: null,
    })
    const res = await GET(makeRequest('Bearer t') as never, makeParams() as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('error')
    expect(body.errorCode).toBe('NO_ITEMS_FOUND')
  })
})
