import { describe, expect, it } from 'vitest'
import { generateIdempotencyKey } from '../../../src/http/idempotency-key-generator'

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('generateIdempotencyKey', () => {
  it('returns a well-formed UUID v4', () => {
    expect(generateIdempotencyKey()).toMatch(UUID_V4_PATTERN)
  })

  it('returns a different value on every call', () => {
    expect(generateIdempotencyKey()).not.toBe(generateIdempotencyKey())
  })
})
