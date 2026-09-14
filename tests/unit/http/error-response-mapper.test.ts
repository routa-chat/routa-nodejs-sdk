import { describe, expect, it } from 'vitest'
import { RoutaApiError } from '../../../src/domain/errors/routa-api-error'
import { RoutaAuthenticationError } from '../../../src/domain/errors/routa-authentication-error'
import { RoutaInvalidRequestError } from '../../../src/domain/errors/routa-invalid-request-error'
import { RoutaProviderError } from '../../../src/domain/errors/routa-provider-error'
import { RoutaRateLimitError } from '../../../src/domain/errors/routa-rate-limit-error'
import { mapErrorResponse } from '../../../src/http/error-response-mapper'

const REQUEST_ID = 'req_01J8XA1B2C3D4E5F6G7H8J9K0M'

// One row per line of the `code → classe → status HTTP` table in
// the SDK's reliability documentation — every code the table lists as an
// example gets its own case, so no documented code is left uncovered.
const MAPPING_TABLE: ReadonlyArray<{
  status: number
  expectedClass: new (...args: never[]) => RoutaApiError
  codes: readonly string[]
}> = [
  {
    status: 401,
    expectedClass: RoutaAuthenticationError,
    codes: ['api_key_invalid', 'invalid_credentials', 'session_invalid'],
  },
  {
    status: 403,
    expectedClass: RoutaInvalidRequestError,
    codes: ['insufficient_scope'],
  },
  {
    status: 404,
    expectedClass: RoutaInvalidRequestError,
    codes: [
      'message_not_found',
      'channel_not_found',
      'template_not_found',
      'media_not_found',
      'event_not_found',
      'webhook_endpoint_not_found',
    ],
  },
  {
    status: 409,
    expectedClass: RoutaApiError,
    codes: [
      'idempotency_in_progress',
      'idempotency_key_reuse',
      'webhook_delivery_not_replayable',
      'email_already_registered',
    ],
  },
  {
    status: 422,
    expectedClass: RoutaInvalidRequestError,
    codes: [
      'content_rejected',
      'invalid_recipient',
      'invalid_cursor',
      'channel_inactive',
      'template_not_approved',
      'media_size_limit_exceeded',
    ],
  },
  {
    status: 429,
    expectedClass: RoutaRateLimitError,
    codes: ['channel_backlog_exceeded', 'rate_limit_exceeded'],
  },
  {
    status: 503,
    expectedClass: RoutaApiError,
    codes: ['service_unavailable'],
  },
]

describe.each(MAPPING_TABLE)(
  'status $status maps to $expectedClass.name',
  ({ status, expectedClass, codes }) => {
    it.each(codes)('code "%s"', code => {
      const error = mapErrorResponse(
        status,
        { code, message: `${code} happened` },
        REQUEST_ID
      )

      expect(error).toBeInstanceOf(RoutaApiError)
      expect(error).toBeInstanceOf(expectedClass)
      expect(error.code).toBe(code)
      expect(error.statusCode).toBe(status)
      expect(error.message).toBe(`${code} happened`)
    })
  }
)

describe('mapErrorResponse — requestId', () => {
  it.each(
    MAPPING_TABLE.flatMap(row => row.codes.map(code => [row.status, code]))
  )(
    'is always the non-empty value passed in, for status %s / code %s',
    (status, code) => {
      const error = mapErrorResponse(
        Number(status),
        { code: String(code) },
        REQUEST_ID
      )
      expect(error.requestId).toBe(REQUEST_ID)
      expect(error.requestId).not.toBe('')
    }
  )
})

describe('mapErrorResponse — 403/404/422 carry param', () => {
  it.each([403, 404, 422])('status %s', status => {
    const error = mapErrorResponse(
      status,
      { code: 'x', param: 'text' },
      REQUEST_ID
    )
    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    expect((error as RoutaInvalidRequestError).param).toBe('text')
  })

  it('leaves param undefined when the envelope has none', () => {
    const error = mapErrorResponse(
      422,
      { code: 'content_rejected' },
      REQUEST_ID
    )
    expect((error as RoutaInvalidRequestError).param).toBeUndefined()
  })
})

describe('mapErrorResponse — 429 carries retryAfter', () => {
  it('propagates retryAfter from the envelope', () => {
    const error = mapErrorResponse(
      429,
      { code: 'channel_backlog_exceeded', retryAfter: 12 },
      REQUEST_ID
    )
    expect(error).toBeInstanceOf(RoutaRateLimitError)
    expect((error as RoutaRateLimitError).retryAfter).toBe(12)
  })

  it('leaves retryAfter undefined when the envelope has none', () => {
    const error = mapErrorResponse(
      429,
      { code: 'rate_limit_exceeded' },
      REQUEST_ID
    )
    expect((error as RoutaRateLimitError).retryAfter).toBeUndefined()
  })
})

describe('mapErrorResponse — docUrl', () => {
  it('propagates docUrl when present', () => {
    const error = mapErrorResponse(
      401,
      {
        code: 'api_key_invalid',
        docUrl: 'https://docs.routa.chat/errors/api_key_invalid',
      },
      REQUEST_ID
    )
    expect(error.docUrl).toBe('https://docs.routa.chat/errors/api_key_invalid')
  })

  it('leaves docUrl undefined when absent', () => {
    const error = mapErrorResponse(401, { code: 'api_key_invalid' }, REQUEST_ID)
    expect(error.docUrl).toBeUndefined()
  })
})

describe('mapErrorResponse — missing envelope fields', () => {
  it('falls back to a generic code and message for an empty envelope', () => {
    const error = mapErrorResponse(500, {}, REQUEST_ID)
    expect(error).toBeInstanceOf(RoutaApiError)
    expect(error.code).toBe('unknown_error')
    expect(error.message.length).toBeGreaterThan(0)
    expect(error.statusCode).toBe(500)
  })
})

describe('mapErrorResponse — unmapped statuses never guess a subtype', () => {
  it.each([400, 405, 418, 500, 502, 503])(
    'status %s falls back to the base RoutaApiError, never a subtype',
    status => {
      const error = mapErrorResponse(status, { code: 'whatever' }, REQUEST_ID)
      expect(error).toBeInstanceOf(RoutaApiError)
      expect(error).not.toBeInstanceOf(RoutaAuthenticationError)
      expect(error).not.toBeInstanceOf(RoutaInvalidRequestError)
      expect(error).not.toBeInstanceOf(RoutaRateLimitError)
      expect(error).not.toBeInstanceOf(RoutaProviderError)
      expect(error.constructor).toBe(RoutaApiError)
    }
  )
})

describe('mapErrorResponse — unknown codes classify by status, never hidden behind the wrong subtype', () => {
  it('an unrecognized code under a mapped status still gets that status’s class', () => {
    const error = mapErrorResponse(
      404,
      { code: 'some_future_resource_not_found' },
      REQUEST_ID
    )
    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    expect(error.code).toBe('some_future_resource_not_found')
  })
})

describe('mapErrorResponse — RoutaProviderError (Q3)', () => {
  it('is never returned for any status documented in the mapping table, including 409 and 5xx', () => {
    for (const { status, codes } of MAPPING_TABLE) {
      for (const code of codes) {
        const error = mapErrorResponse(status, { code }, REQUEST_ID)
        expect(error).not.toBeInstanceOf(RoutaProviderError)
      }
    }
  })

  it('remains constructible directly as a reserved subtype of RoutaApiError', () => {
    const error = new RoutaProviderError('provider rejected the message', {
      code: 'provider_rejected',
      requestId: REQUEST_ID,
      docUrl: undefined,
      statusCode: 422,
    })
    expect(error).toBeInstanceOf(RoutaApiError)
    expect(error).toBeInstanceOf(RoutaProviderError)
  })
})
