/**
 * Unit tests for the OCR background function (processOcrJob).
 * Tests the full OCR pipeline: image fetch → pdf-parse → Claude → normalize → write result.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
process.env.ANTHROPIC_API_KEY ??= 'test-anthropic-key'

const mockGetUser = vi.fn()
const mockCreateSignedUrl = vi.fn()
const mockMessagesCreate = vi.fn()
const mockJobSelect = vi.fn()
const mockJobUpdate = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) },
    from: (table: string) => {
      if (table === 'receipt_parse_jobs') {
        return {
          select: () => ({ eq: () => ({ single: mockJobSelect }) }),
          update: (data: unknown) => ({
            _data: data,
            eq: () => Promise.resolve({ error: null }),
          }),
        }
      }
      return {}
    },
  }),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockMessagesCreate }
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const mockPdfParse = vi.fn()
vi.mock('pdf-parse', () => ({ default: mockPdfParse }))

const { processOcrJob } = await import('../../netlify/functions/ocr-process-background')

const VALID_JOB_ID = 'job-uuid-111'
const VALID_USER_ID = 'user-abc-123'
const VALID_STORAGE_PATH = `${VALID_USER_ID}/receipt.jpg`

const VALID_CLAUDE_RESPONSE = {
  store: 'Biedronka',
  date: '2026-04-01',
  items: [{ name: 'Chleb', quantity: 1, unit_price: 3.49, total_price: 3.49, category: 'Bakery', confidence: 'high' }],
  total: 3.49,
  confidence: 'high',
}

function setupHappyPath() {
  mockJobSelect.mockResolvedValue({
    data: { id: VALID_JOB_ID, user_id: VALID_USER_ID, storage_path: VALID_STORAGE_PATH, status: 'pending' },
    error: null,
  })
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
    content: [{ type: 'text', text: JSON.stringify(VALID_CLAUDE_RESPONSE) }],
    stop_reason: 'end_turn',
  })
  mockPdfParse.mockResolvedValue({ text: '' })
}

describe('processOcrJob', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('fetches job, calls Claude, and does not throw on valid JPEG receipt', async () => {
    setupHappyPath()
    await expect(processOcrJob(VALID_JOB_ID)).resolves.toBeUndefined()
    expect(mockMessagesCreate).toHaveBeenCalledOnce()
  })

  it('uses document message path for scanned PDF (< 150 chars extracted)', async () => {
    setupHappyPath()
    mockJobSelect.mockResolvedValue({
      data: { id: VALID_JOB_ID, user_id: VALID_USER_ID, storage_path: `${VALID_USER_ID}/receipt.pdf`, status: 'pending' },
      error: null,
    })
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('%PDF-1.4 fake'),
      headers: { get: () => 'application/pdf' },
    })
    mockPdfParse.mockResolvedValue({ text: 'short' })

    await processOcrJob(VALID_JOB_ID)

    const claudeCall = mockMessagesCreate.mock.calls[0][0]
    expect(claudeCall.messages[0].content[0].type).toBe('document')
  })

  it('uses text message path for digital PDF (≥ 150 chars extracted)', async () => {
    setupHappyPath()
    mockJobSelect.mockResolvedValue({
      data: { id: VALID_JOB_ID, user_id: VALID_USER_ID, storage_path: `${VALID_USER_ID}/receipt.pdf`, status: 'pending' },
      error: null,
    })
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('%PDF-1.4 fake'),
      headers: { get: () => 'application/pdf' },
    })
    const longText = 'Biedronka\n' + 'Chleb 3.49\n'.repeat(20)
    mockPdfParse.mockResolvedValue({ text: longText })

    await processOcrJob(VALID_JOB_ID)

    const claudeCall = mockMessagesCreate.mock.calls[0][0]
    expect(claudeCall.messages[0].content[0].type).toBe('text')
    expect(claudeCall.messages[0].content[0].text).toContain(longText)
  })

  it('handles job not found without throwing', async () => {
    mockJobSelect.mockResolvedValue({ data: null, error: new Error('not found') })
    await expect(processOcrJob('nonexistent')).resolves.toBeUndefined()
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })
})
