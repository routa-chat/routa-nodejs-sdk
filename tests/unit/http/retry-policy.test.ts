import { describe, expect, it } from 'vitest'
import {
  calculateBackoffDelayMs,
  isRetryableFailure,
  parseRetryAfterMs,
} from '../../../src/http/retry-policy'

describe('isRetryableFailure', () => {
  it('never retries 401 (authentication)', () => {
    expect(isRetryableFailure(401, undefined)).toBe(false)
  })

  it('never retries 403 (insufficient scope)', () => {
    expect(isRetryableFailure(403, 'insufficient_scope')).toBe(false)
  })

  it('never retries 404 (not found)', () => {
    expect(isRetryableFailure(404, 'message_not_found')).toBe(false)
  })

  it('retries 409 idempotency_in_progress', () => {
    expect(isRetryableFailure(409, 'idempotency_in_progress')).toBe(true)
  })

  it('never retries 409 idempotency_key_reuse', () => {
    expect(isRetryableFailure(409, 'idempotency_key_reuse')).toBe(false)
  })

  it('never retries 422 (validation/content rejected)', () => {
    expect(isRetryableFailure(422, 'content_rejected')).toBe(false)
  })

  it('retries 429 (rate limit)', () => {
    expect(isRetryableFailure(429, undefined)).toBe(true)
  })

  it('retries 5xx (server/infrastructure errors)', () => {
    expect(isRetryableFailure(500, undefined)).toBe(true)
    expect(isRetryableFailure(503, 'service_unavailable')).toBe(true)
  })
})

describe('calculateBackoffDelayMs', () => {
  it('returns 0 when the random source returns 0, for any attempt', () => {
    expect(calculateBackoffDelayMs(0, () => 0)).toBe(0)
    expect(calculateBackoffDelayMs(5, () => 0)).toBe(0)
  })

  it('grows the upper bound exponentially, capped at a fixed ceiling', () => {
    const maxAtAttempt = (attempt: number) =>
      calculateBackoffDelayMs(attempt, () => 1)

    expect(maxAtAttempt(0)).toBe(500)
    expect(maxAtAttempt(1)).toBe(1_000)
    expect(maxAtAttempt(2)).toBe(2_000)
    expect(maxAtAttempt(10)).toBe(8_000) // capped
  })
})

describe('parseRetryAfterMs', () => {
  it('returns undefined when the header is absent', () => {
    expect(parseRetryAfterMs(null)).toBeUndefined()
  })

  it('parses a delta-seconds value into milliseconds', () => {
    expect(parseRetryAfterMs('2')).toBe(2_000)
  })

  it('parses an HTTP-date value into a millisecond delay from now', () => {
    const futureDate = new Date(Date.now() + 5_000)
    const delay = parseRetryAfterMs(futureDate.toUTCString())

    expect(delay).toBeGreaterThan(4_000)
    expect(delay).toBeLessThanOrEqual(5_000)
  })

  it('returns undefined for an unparseable value', () => {
    expect(parseRetryAfterMs('not-a-valid-value')).toBeUndefined()
  })
})
