import { describe, expect, it } from 'vitest'
import { RoutaApiError } from '../../../src/domain/errors/routa-api-error'
import { RoutaAuthenticationError } from '../../../src/domain/errors/routa-authentication-error'
import { RoutaBillingError } from '../../../src/domain/errors/routa-billing-error'
import { RoutaConflictError } from '../../../src/domain/errors/routa-conflict-error'
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
    status: 402,
    expectedClass: RoutaBillingError,
    codes: [
      'subscription_required',
      'payment_failed',
      'free_messages_exhausted',
      'message_quota_exceeded',
      'project_limit_exceeded',
      'channel_limit_exceeded',
    ],
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
    expectedClass: RoutaConflictError,
    codes: [
      'idempotency_in_progress',
      'idempotency_key_reuse',
      'webhook_delivery_not_replayable',
      'email_already_registered',
      'template_not_editable',
      'channel_not_disabled',
      'project_not_deletable',
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

describe('mapErrorResponse — type and details', () => {
  it('carries the API error type and details on any error', () => {
    const error = mapErrorResponse(
      500,
      { code: 'x', type: 'api_error', details: { limit: 5 } },
      REQUEST_ID
    )
    expect(error.type).toBe('api_error')
    expect(error.details).toEqual({ limit: 5 })
  })

  it('leaves type and details undefined for a response that has none, such as a proxy’s', () => {
    const error = mapErrorResponse(502, { code: 'x' }, REQUEST_ID)
    expect(error.type).toBeUndefined()
    expect(error.details).toBeUndefined()
  })
})

describe('mapErrorResponse — 402 is a RoutaBillingError carrying the numbers', () => {
  it('exposes limit and used of free_messages_exhausted', () => {
    const error = mapErrorResponse(
      402,
      {
        code: 'free_messages_exhausted',
        type: 'billing_error',
        details: { limit: 10, used: 10 },
      },
      REQUEST_ID
    )

    expect(error).toBeInstanceOf(RoutaBillingError)
    expect(error).toBeInstanceOf(RoutaApiError)
    const billing = error as RoutaBillingError
    expect(billing.limit).toBe(10)
    expect(billing.used).toBe(10)
    expect(billing.resetsAt).toBeUndefined()
    expect(billing.statusCode).toBe(402)
    expect(billing.type).toBe('billing_error')
  })

  it('also exposes resetsAt of message_quota_exceeded', () => {
    const error = mapErrorResponse(
      402,
      {
        code: 'message_quota_exceeded',
        details: {
          limit: 1000,
          used: 1000,
          resets_at: '2026-12-01T00:00:00.000Z',
        },
      },
      REQUEST_ID
    ) as RoutaBillingError

    expect(error.limit).toBe(1000)
    expect(error.used).toBe(1000)
    expect(error.resetsAt).toBe('2026-12-01T00:00:00.000Z')
  })

  it('exposes only limit for a project or channel limit', () => {
    const error = mapErrorResponse(
      402,
      { code: 'channel_limit_exceeded', details: { limit: 3 } },
      REQUEST_ID
    ) as RoutaBillingError

    expect(error.limit).toBe(3)
    expect(error.used).toBeUndefined()
  })

  it('has no numbers when the API sent no details (subscription_required)', () => {
    const error = mapErrorResponse(
      402,
      { code: 'subscription_required' },
      REQUEST_ID
    ) as RoutaBillingError

    expect(error.limit).toBeUndefined()
    expect(error.used).toBeUndefined()
    expect(error.resetsAt).toBeUndefined()
  })

  it('ignores a details value of the wrong type instead of exposing it as a number', () => {
    const error = mapErrorResponse(
      402,
      { code: 'free_messages_exhausted', details: { limit: 'ten', used: 10 } },
      REQUEST_ID
    ) as RoutaBillingError

    expect(error.limit).toBeUndefined()
    expect(error.used).toBe(10)
  })
})

describe('mapErrorResponse — 409 is a RoutaConflictError', () => {
  it('exposes details.reason of project_not_deletable', () => {
    const error = mapErrorResponse(
      409,
      {
        code: 'project_not_deletable',
        type: 'conflict_error',
        details: { reason: 'has_enabled_channel' },
      },
      REQUEST_ID
    )

    expect(error).toBeInstanceOf(RoutaConflictError)
    expect(error).toBeInstanceOf(RoutaApiError)
    expect((error as RoutaConflictError).reason).toBe('has_enabled_channel')
  })

  it('leaves reason undefined when the conflict has none', () => {
    const error = mapErrorResponse(
      409,
      { code: 'template_not_editable' },
      REQUEST_ID
    ) as RoutaConflictError

    expect(error.reason).toBeUndefined()
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
      expect(error).not.toBeInstanceOf(RoutaBillingError)
      expect(error).not.toBeInstanceOf(RoutaConflictError)
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
