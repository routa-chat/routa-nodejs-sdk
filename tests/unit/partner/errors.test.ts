import { describe, expect, it } from 'vitest'
import { RoutaApiError } from '../../../src/domain/errors/routa-api-error'
import { RoutaAuthenticationError } from '../../../src/domain/errors/routa-authentication-error'
import { RoutaBillingError } from '../../../src/domain/errors/routa-billing-error'
import { RoutaInvalidRequestError } from '../../../src/domain/errors/routa-invalid-request-error'
import { RoutaRateLimitError } from '../../../src/domain/errors/routa-rate-limit-error'
import { RoutaPartner } from '../../../src/partner'
import {
  errorEnvelope,
  PARTNER_KEY,
  partnerWith,
  scriptedFetch,
} from './support'

describe('errors thrown by RoutaPartner', () => {
  it('maps 404 partner_api_not_available to RoutaInvalidRequestError', async () => {
    const { partner } = partnerWith([
      {
        status: 404,
        body: errorEnvelope(
          'not_found_error',
          'partner_api_not_available',
          'The Partner API is not available on this organization’s plan.'
        ),
      },
    ])

    const failure = await partner.projects
      .list()
      .page()
      .catch(e => e)

    expect(failure).toBeInstanceOf(RoutaInvalidRequestError)
    expect(failure).toBeInstanceOf(RoutaApiError)
    expect(failure.code).toBe('partner_api_not_available')
    expect(failure.statusCode).toBe(404)
    expect(failure.message).toMatch(/Partner API is not available/)
  })

  it('maps 402 project_limit_exceeded to RoutaBillingError with the limit', async () => {
    const { partner } = partnerWith([
      {
        status: 402,
        body: errorEnvelope(
          'billing_error',
          'project_limit_exceeded',
          'Project limit reached.',
          { limit: 10 }
        ),
      },
    ])

    const failure = await partner.projects
      .create({ name: 'x', externalRef: 'lead_1' })
      .catch(e => e)

    expect(failure).toBeInstanceOf(RoutaBillingError)
    expect(failure.code).toBe('project_limit_exceeded')
    expect(failure.limit).toBe(10)
  })

  it('maps 401 to RoutaAuthenticationError — what a project API key gets on /v1/partner/*', async () => {
    const { partner } = partnerWith([
      {
        status: 401,
        body: errorEnvelope(
          'authentication_error',
          'invalid_api_key',
          'Bad key.'
        ),
      },
    ])

    const failure = await partner.webhook.retrieve().catch(e => e)

    expect(failure).toBeInstanceOf(RoutaAuthenticationError)
  })

  it('maps 403 for a missing scope to RoutaInvalidRequestError', async () => {
    const { partner } = partnerWith([
      {
        status: 403,
        body: errorEnvelope(
          'permission_error',
          'insufficient_scope',
          'No scope.'
        ),
      },
    ])

    const failure = await partner.webhook.rotateSecret().catch(e => e)

    expect(failure).toBeInstanceOf(RoutaInvalidRequestError)
    expect(failure.statusCode).toBe(403)
  })

  it('maps 429 to RoutaRateLimitError with Retry-After', async () => {
    const { partner } = partnerWith([
      {
        status: 429,
        headers: { 'Retry-After': '7' },
        body: errorEnvelope(
          'rate_limit_error',
          'rate_limit_exceeded',
          'Slow down.'
        ),
      },
    ])

    const failure = await partner.channels
      .list()
      .page()
      .catch(e => e)

    expect(failure).toBeInstanceOf(RoutaRateLimitError)
    expect(failure.retryAfter).toBe(7)
  })
})

describe('retries', () => {
  it('rides out a 429 with Retry-After: 0 when retries are on', async () => {
    const { fetch } = scriptedFetch([
      {
        status: 429,
        headers: { 'Retry-After': '0' },
        body: errorEnvelope(
          'rate_limit_error',
          'rate_limit_exceeded',
          'Slow down.'
        ),
      },
      { status: 200, body: { data: [], has_more: false, next_cursor: null } },
    ])
    const partner = new RoutaPartner({
      partnerKey: PARTNER_KEY,
      baseURL: 'http://api.test',
      maxRetries: 1,
      fetch,
    })

    const page = await partner.channels.list().page()

    expect(page.data).toEqual([])
  })
})
