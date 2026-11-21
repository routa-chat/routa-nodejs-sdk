import { expectTypeOf, test } from 'vitest'
import type { RoutaApiError } from '../../src/domain/errors/routa-api-error'
import { RoutaAuthenticationError } from '../../src/domain/errors/routa-authentication-error'
import { RoutaBillingError } from '../../src/domain/errors/routa-billing-error'
import { RoutaConflictError } from '../../src/domain/errors/routa-conflict-error'
import { RoutaInvalidRequestError } from '../../src/domain/errors/routa-invalid-request-error'
import { RoutaProviderError } from '../../src/domain/errors/routa-provider-error'
import { RoutaRateLimitError } from '../../src/domain/errors/routa-rate-limit-error'
import { RoutaSignatureVerificationError } from '../../src/domain/errors/routa-signature-verification-error'
import { mapErrorResponse } from '../../src/http/error-response-mapper'

test('mapErrorResponse returns RoutaApiError, narrowing to a subtype via instanceof', () => {
  const error = mapErrorResponse(401, { code: 'api_key_invalid' }, 'req_1')
  expectTypeOf(error).toEqualTypeOf<RoutaApiError>()

  if (error instanceof RoutaAuthenticationError) {
    expectTypeOf(error).toEqualTypeOf<RoutaAuthenticationError>()
  }

  if (error instanceof RoutaInvalidRequestError) {
    expectTypeOf(error).toEqualTypeOf<RoutaInvalidRequestError>()
    expectTypeOf(error.param).toEqualTypeOf<string | undefined>()
  }

  if (error instanceof RoutaRateLimitError) {
    expectTypeOf(error).toEqualTypeOf<RoutaRateLimitError>()
    expectTypeOf(error.retryAfter).toEqualTypeOf<number | undefined>()
  }
})

test('every RoutaApiError carries code, requestId, docUrl and statusCode', () => {
  const error = mapErrorResponse(422, { code: 'content_rejected' }, 'req_1')
  expectTypeOf(error.code).toEqualTypeOf<string>()
  expectTypeOf(error.requestId).toEqualTypeOf<string>()
  expectTypeOf(error.docUrl).toEqualTypeOf<string | undefined>()
  expectTypeOf(error.statusCode).toEqualTypeOf<number>()
})

test('RoutaProviderError is a RoutaApiError subtype, constructible independently of mapErrorResponse', () => {
  const error = new RoutaProviderError('provider rejected the message', {
    code: 'provider_rejected',
    requestId: 'req_1',
    docUrl: undefined,
    statusCode: 422,
  })
  expectTypeOf(error).toMatchTypeOf<RoutaApiError>()
})

test('RoutaSignatureVerificationError does not extend RoutaApiError', () => {
  // @ts-expect-error — signature verification failures never come from an HTTP response.
  const wrong: RoutaApiError = new RoutaSignatureVerificationError(
    'bad signature'
  )
  void wrong
})

test('RoutaBillingError and RoutaConflictError narrow from a RoutaApiError and expose their details', () => {
  const error = mapErrorResponse(402, { code: 'free_messages_exhausted' }, 'r')

  if (error instanceof RoutaBillingError) {
    expectTypeOf(error).toEqualTypeOf<RoutaBillingError>()
    expectTypeOf(error).toMatchTypeOf<RoutaApiError>()
    expectTypeOf(error.limit).toEqualTypeOf<number | undefined>()
    expectTypeOf(error.used).toEqualTypeOf<number | undefined>()
    expectTypeOf(error.resetsAt).toEqualTypeOf<string | undefined>()
  }

  if (error instanceof RoutaConflictError) {
    expectTypeOf(error).toEqualTypeOf<RoutaConflictError>()
    expectTypeOf(error).toMatchTypeOf<RoutaApiError>()
    expectTypeOf(error.reason).toEqualTypeOf<string | undefined>()
  }
})

test('every RoutaApiError carries the optional type and details', () => {
  const error = mapErrorResponse(500, { code: 'x' }, 'r')
  expectTypeOf(error.type).toEqualTypeOf<string | undefined>()
  expectTypeOf(error.details).toEqualTypeOf<
    Readonly<Record<string, string | number>> | undefined
  >()
})
