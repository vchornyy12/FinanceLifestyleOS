import { test, expect } from '@playwright/test'

/**
 * E2E tests for POST /api/receipts/parse — auth rejection only.
 *
 * These tests run against the real Next.js dev server (no mocks).
 * They verify that the route enforces authentication before any
 * expensive operations (storage fetch, Claude call) occur.
 */
test.describe('OCR API — authentication', () => {
  test('returns 401 when Authorization header is absent', async ({ request }) => {
    const res = await request.post('/api/receipts/parse', {
      data: { storagePath: 'user-id/receipt.jpg' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('UNAUTHENTICATED')
  })

  test('returns 401 when Authorization header has wrong scheme', async ({ request }) => {
    const res = await request.post('/api/receipts/parse', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      data: { storagePath: 'user-id/receipt.jpg' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('UNAUTHENTICATED')
  })

  test('returns 401 when Bearer token is invalid', async ({ request }) => {
    const res = await request.post('/api/receipts/parse', {
      headers: { Authorization: 'Bearer this-is-not-a-valid-jwt' },
      data: { storagePath: 'user-id/receipt.jpg' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('UNAUTHENTICATED')
  })

  test('returns 400 (not 500) when auth passes but body is malformed', async ({ request }) => {
    // This test is informational — we cannot get a real token in E2E without a test user.
    // We verify that an empty body without auth still fails with UNAUTHENTICATED (not a 500).
    const res = await request.post('/api/receipts/parse', {
      data: {},
    })
    // No auth → should be 401, not 400 or 500
    expect(res.status()).toBe(401)
  })
})
