import { describe, expect, it } from 'vitest'
import { RoutaApiError } from '../../../../src/domain/errors/routa-api-error'
import { RoutaAuthenticationError } from '../../../../src/domain/errors/routa-authentication-error'
import { RoutaInvalidRequestError } from '../../../../src/domain/errors/routa-invalid-request-error'
import { RoutaProviderError } from '../../../../src/domain/errors/routa-provider-error'
import { RoutaRateLimitError } from '../../../../src/domain/errors/routa-rate-limit-error'
import { RoutaSignatureVerificationError } from '../../../../src/domain/errors/routa-signature-verification-error'

const BASE_DETAILS = {
  code: 'something_failed',
  requestId: 'req_01J8XA1B2C3D4E5F6G7H8J9K0M',
  docUrl: undefined,
  statusCode: 400,
}

describe('RoutaApiError', () => {
  it('carries code, requestId, docUrl and statusCode', () => {
    const error = new RoutaApiError('failed', {
      ...BASE_DETAILS,
      docUrl: 'https://docs.routa.chat/errors/something_failed',
    })

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('RoutaApiError')
    expect(error.message).toBe('failed')
    expect(error.code).toBe('something_failed')
    expect(error.requestId).toBe('req_01J8XA1B2C3D4E5F6G7H8J9K0M')
    expect(error.docUrl).toBe('https://docs.routa.chat/errors/something_failed')
    expect(error.statusCode).toBe(400)
  })

  it('leaves docUrl undefined when the server did not send one', () => {
    const error = new RoutaApiError('failed', BASE_DETAILS)
    expect(error.docUrl).toBeUndefined()
  })
})

describe('RoutaAuthenticationError', () => {
  it('is a RoutaApiError with the expected name', () => {
    const error = new RoutaAuthenticationError('bad key', BASE_DETAILS)
    expect(error).toBeInstanceOf(RoutaApiError)
    expect(error).toBeInstanceOf(RoutaAuthenticationError)
    expect(error.name).toBe('RoutaAuthenticationError')
  })
})

describe('RoutaInvalidRequestError', () => {
  it('carries an optional param', () => {
    const error = new RoutaInvalidRequestError('bad field', {
      ...BASE_DETAILS,
      param: 'text',
    })
    expect(error).toBeInstanceOf(RoutaApiError)
    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    expect(error.name).toBe('RoutaInvalidRequestError')
    expect(error.param).toBe('text')
  })

  it('leaves param undefined when the server did not name a field', () => {
    const error = new RoutaInvalidRequestError('bad request', {
      ...BASE_DETAILS,
      param: undefined,
    })
    expect(error.param).toBeUndefined()
  })
})

describe('RoutaRateLimitError', () => {
  it('carries an optional retryAfter', () => {
    const error = new RoutaRateLimitError('slow down', {
      ...BASE_DETAILS,
      retryAfter: 30,
    })
    expect(error).toBeInstanceOf(RoutaApiError)
    expect(error).toBeInstanceOf(RoutaRateLimitError)
    expect(error.name).toBe('RoutaRateLimitError')
    expect(error.retryAfter).toBe(30)
  })

  it('leaves retryAfter undefined when the server did not send one', () => {
    const error = new RoutaRateLimitError('slow down', {
      ...BASE_DETAILS,
      retryAfter: undefined,
    })
    expect(error.retryAfter).toBeUndefined()
  })
})

describe('RoutaProviderError', () => {
  it('is a RoutaApiError with the expected name', () => {
    const error = new RoutaProviderError(
      'provider rejected the message',
      BASE_DETAILS
    )
    expect(error).toBeInstanceOf(RoutaApiError)
    expect(error).toBeInstanceOf(RoutaProviderError)
    expect(error.name).toBe('RoutaProviderError')
  })
})

describe('RoutaSignatureVerificationError', () => {
  it('is a plain Error, not a RoutaApiError', () => {
    const error = new RoutaSignatureVerificationError('signature mismatch')
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(RoutaApiError)
    expect(error.name).toBe('RoutaSignatureVerificationError')
    expect(error.message).toBe('signature mismatch')
  })
})
