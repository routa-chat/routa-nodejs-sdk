import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { Routa } from '../../src/client'
import { RoutaApiError } from '../../src/domain/errors/routa-api-error'
import { RoutaBillingError } from '../../src/domain/errors/routa-billing-error'

/**
 * `402` on `messages.send()` → `RoutaBillingError`, over a real socket, with no
 * retry.
 *
 * **This does not run against the reference API, and says so on purpose.**
 * The API answers `402` only after it has resolved the channel
 * (`SendMessage` resolves the channel before it checks the entitlement), so
 * provoking one needs a real, working channel — and then either a live project
 * that has used its 10 lifetime free messages or one past its plan allowance.
 * A test project is never refused for billing. Spending the free messages of the
 * `ROUTA_TEST_CHANNEL_ID` project, or subscribing one to a plan and exhausting
 * it, would wreck the fixture every other scenario relies on, and the suite has
 * no way to provision a channel of its own (see CONTRIBUTING.md).
 *
 * So the response is assembled, not captured: the envelope is the
 * `ErrorEnvelope` the OpenAPI snapshot documents for `402` on `POST /v1/messages`
 * (`error.type`, `code`, `message`, `request_id`, `details` as a map of
 * strings and numbers) and the `details` names are the ones the backend writes
 * (`detailsOf` in `apps/api/src/http/errors.ts`: `limit`/`used` for
 * `free_messages_exhausted`, plus `resets_at` for `message_quota_exceeded`).
 * What it does exercise is the whole client path on a real socket — the retry
 * loop at its default of three retries — which the unit tests of the mapper and
 * of the HTTP client reach only through a fake `fetch`. Like the `429` scenario
 * in `rate-limit-retry.test.ts`, it needs no API instance and always runs.
 */
interface BillingScenario {
  readonly code: string
  readonly details?: Record<string, string | number>
}

let server: Server | undefined

afterEach(async () => {
  const running = server
  server = undefined
  if (running) {
    await new Promise<void>(done => running.close(() => done()))
  }
})

/** Serves the same `402` to every `POST /v1/messages` and counts the requests. */
async function serveBilling(
  scenario: BillingScenario
): Promise<{ baseUrl: string; requests: () => number }> {
  let count = 0
  const running = createServer((req, res) => {
    req.resume()
    count += 1
    res.writeHead(402, {
      'content-type': 'application/json',
      'routa-request-id': 'req_billing_1',
    })
    res.end(
      JSON.stringify({
        error: {
          type: 'billing_error',
          code: scenario.code,
          message: 'The request was refused by the billing state.',
          ...(scenario.details ? { details: scenario.details } : {}),
          request_id: 'req_billing_1',
        },
      })
    )
  })
  server = running
  await new Promise<void>(ready => running.listen(0, '127.0.0.1', ready))
  const { port } = running.address() as AddressInfo
  return { baseUrl: `http://127.0.0.1:${port}`, requests: () => count }
}

async function sendAndCatch(baseUrl: string): Promise<unknown> {
  // The default `maxRetries` (3): the point is that a 402 is *not* retried.
  const routa = new Routa({ apiKey: 'rt_test_conformance', baseURL: baseUrl })
  return routa.messages
    .send({ channel: 'chan_conformance', to: '+5581999999999', text: 'hi' })
    .then(() => undefined)
    .catch((error: unknown) => error)
}

describe('402 billing_error — local HTTP server', () => {
  it('free_messages_exhausted: RoutaBillingError with limit and used, after exactly one request', async () => {
    const { baseUrl, requests } = await serveBilling({
      code: 'free_messages_exhausted',
      details: { limit: 10, used: 10 },
    })

    const error = await sendAndCatch(baseUrl)

    expect(error).toBeInstanceOf(RoutaBillingError)
    expect(error).toBeInstanceOf(RoutaApiError)
    const billing = error as RoutaBillingError
    expect(billing.statusCode).toBe(402)
    expect(billing.type).toBe('billing_error')
    expect(billing.code).toBe('free_messages_exhausted')
    expect(billing.limit).toBe(10)
    expect(billing.used).toBe(10)
    expect(billing.resetsAt).toBeUndefined()
    expect(billing.details).toEqual({ limit: 10, used: 10 })
    expect(billing.requestId).toBe('req_billing_1')
    expect(requests()).toBe(1)
  })

  it('message_quota_exceeded: also carries resetsAt', async () => {
    const { baseUrl, requests } = await serveBilling({
      code: 'message_quota_exceeded',
      details: {
        limit: 1000,
        used: 1000,
        resets_at: '2026-12-01T00:00:00.000Z',
      },
    })

    const error = await sendAndCatch(baseUrl)

    expect(error).toBeInstanceOf(RoutaBillingError)
    const billing = error as RoutaBillingError
    expect(billing.limit).toBe(1000)
    expect(billing.used).toBe(1000)
    expect(billing.resetsAt).toBe('2026-12-01T00:00:00.000Z')
    expect(requests()).toBe(1)
  })

  it('subscription_required: no details at all, every number undefined, still not retried', async () => {
    const { baseUrl, requests } = await serveBilling({
      code: 'subscription_required',
    })

    const error = await sendAndCatch(baseUrl)

    expect(error).toBeInstanceOf(RoutaBillingError)
    const billing = error as RoutaBillingError
    expect(billing.code).toBe('subscription_required')
    expect(billing.limit).toBeUndefined()
    expect(billing.used).toBeUndefined()
    expect(billing.resetsAt).toBeUndefined()
    expect(billing.details).toBeUndefined()
    expect(requests()).toBe(1)
  })
})
