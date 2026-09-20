import { describe, expect, it } from 'vitest'
import { Routa } from '../../src/client'
import { RoutaApiError } from '../../src/domain/errors/routa-api-error'
import { RoutaAuthenticationError } from '../../src/domain/errors/routa-authentication-error'
import { RoutaInvalidRequestError } from '../../src/domain/errors/routa-invalid-request-error'
import { RoutaRateLimitError } from '../../src/domain/errors/routa-rate-limit-error'
import type { MessageId } from '../../src/message/message-id'
import {
  apiReachable,
  BASE_URL,
  hasChannelFixture,
  requireChannelFixture,
} from './support/environment'
import { provisionApiKey } from './support/provisioning'

/**
 * Every `error.type`/`code` → SDK error class mapping in the SDK's
 * reliability documentation, produced by a real call against a real API
 * instance — never a canned HTTP response standing in for the server. Each
 * scenario provisions its own fresh organization/project/API key over real
 * HTTP, so none of these need a pre-connected channel: the ones below all
 * fail (or succeed) before or without ever needing a real channel to exist.
 */
describe.skipIf(!apiReachable)('error mapping — real API server', () => {
  it('401 api_key_invalid — an unrecognized bearer token', async () => {
    const routa = new Routa({
      apiKey: 'rt_live_not_a_real_key_00000000',
      baseURL: BASE_URL,
      maxRetries: 0,
    })

    const error = await routa.messages
      .send({ channel: 'chan_doesnotexist', to: '+15550002222', text: 'hi' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaAuthenticationError)
    const authError = error as RoutaAuthenticationError
    expect(authError.code).toBe('api_key_invalid')
    expect(authError.statusCode).toBe(401)
    expect(authError.requestId).toBeTruthy()
  })

  it('403 insufficient_scope — a key issued without messages:write', async () => {
    const { apiKey } = await provisionApiKey(BASE_URL, ['messages:read'])
    const routa = new Routa({
      apiKey: apiKey.secret,
      baseURL: BASE_URL,
      maxRetries: 0,
    })

    const error = await routa.messages
      .send({ channel: 'chan_doesnotexist', to: '+15550002222', text: 'hi' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    const scopeError = error as RoutaInvalidRequestError
    expect(scopeError.code).toBe('insufficient_scope')
    expect(scopeError.statusCode).toBe(403)
  })

  it('404 message_not_found — retrieving a message id that does not exist', async () => {
    const { apiKey } = await provisionApiKey(BASE_URL, ['messages:read'])
    const routa = new Routa({
      apiKey: apiKey.secret,
      baseURL: BASE_URL,
      maxRetries: 0,
    })

    const error = await routa.messages
      .retrieve('msg_doesnotexist00000000000000' as MessageId)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    expect((error as RoutaInvalidRequestError).code).toBe('message_not_found')
    expect((error as RoutaInvalidRequestError).statusCode).toBe(404)
  })

  it('404 channel_not_found — sending through a channel id that does not exist', async () => {
    const { apiKey } = await provisionApiKey(BASE_URL, ['messages:write'])
    const routa = new Routa({
      apiKey: apiKey.secret,
      baseURL: BASE_URL,
      maxRetries: 0,
    })

    const error = await routa.messages
      .send({
        channel: 'chan_doesnotexist00000000000000',
        to: '+15550002222',
        text: 'hi',
      })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    expect((error as RoutaInvalidRequestError).code).toBe('channel_not_found')
    expect((error as RoutaInvalidRequestError).statusCode).toBe(404)
  })

  it('422 invalid_recipient — a `to` that is not a parseable E.164 number', async () => {
    const { apiKey } = await provisionApiKey(BASE_URL, ['messages:write'])
    const routa = new Routa({
      apiKey: apiKey.secret,
      baseURL: BASE_URL,
      maxRetries: 0,
    })

    const error = await routa.messages
      .send({
        channel: 'chan_doesnotexist',
        to: 'not-a-phone-number',
        text: 'hi',
      })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    expect((error as RoutaInvalidRequestError).code).toBe('invalid_recipient')
    expect((error as RoutaInvalidRequestError).statusCode).toBe(422)
  })

  it('422 content_rejected — text that fails server-side content validation', async () => {
    const { apiKey } = await provisionApiKey(BASE_URL, ['messages:write'])
    const routa = new Routa({
      apiKey: apiKey.secret,
      baseURL: BASE_URL,
      maxRetries: 0,
    })

    const error = await routa.messages
      .send({ channel: 'chan_doesnotexist', to: '+15550002222', text: '' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    expect((error as RoutaInvalidRequestError).code).toBe('content_rejected')
    expect((error as RoutaInvalidRequestError).statusCode).toBe(422)
  })

  it("429 rate_limit_exceeded — exhausting a fresh project's send burst", async () => {
    const { apiKey } = await provisionApiKey(BASE_URL, ['messages:write'])
    const routa = new Routa({
      apiKey: apiKey.secret,
      baseURL: BASE_URL,
      maxRetries: 0,
    })

    // The default `sends` burst is 100 (the reference API's rate-limiting
    // logic) — every one of these targets a nonexistent channel, so none
    // creates a message; the rate limiter runs before channel resolution, so
    // it is the only thing any of these requests can ever hit before a 404.
    // Requests are sent one at a time, not concurrently: the real limiter's
    // check-then-write is a single, deliberately non-atomic round trip (it
    // favors briefly over-admitting a burst over rejecting valid traffic),
    // so a flood of truly concurrent requests can race past it — the same
    // way a flood of concurrent requests can race past any check-then-write
    // counter. Sequential requests exhaust it deterministically instead.
    // Sequential SDK calls carry more per-call overhead than a raw fetch loop
    // (idempotency key generation, header assembly), which gives the bucket
    // more wall-clock time to refill between requests — 200 attempts leaves
    // comfortable headroom over the 100-request burst plus refill.
    let rateLimitError: unknown
    for (let attempt = 0; attempt < 200 && !rateLimitError; attempt++) {
      const error = await routa.messages
        .send({ channel: 'chan_doesnotexist', to: '+15550002222', text: 'hi' })
        .then(() => undefined)
        .catch((e: unknown) => e)
      if (error instanceof RoutaRateLimitError) {
        rateLimitError = error
      }
    }

    expect(rateLimitError).toBeInstanceOf(RoutaRateLimitError)
    const typedError = rateLimitError as RoutaRateLimitError
    expect(typedError.code).toBe('rate_limit_exceeded')
    expect(typedError.statusCode).toBe(429)
    expect(typedError.retryAfter).toBeGreaterThan(0)
  })

  describe.skipIf(!hasChannelFixture)(
    '409 conflicts — need a real accepted send first',
    () => {
      it('409 idempotency_key_reuse — same key, different body', async () => {
        const { apiKey, channelId, to } = requireChannelFixture()
        const routa = new Routa({ apiKey, baseURL: BASE_URL, maxRetries: 0 })
        const idempotencyKey = `conformance-reuse-${crypto.randomUUID()}`

        await routa.messages.send({
          channel: channelId,
          to,
          text: 'first body',
          idempotencyKey,
        })
        const error = await routa.messages
          .send({
            channel: channelId,
            to,
            text: 'a different body',
            idempotencyKey,
          })
          .catch((e: unknown) => e)

        expect(error).toBeInstanceOf(RoutaApiError)
        expect(error).not.toBeInstanceOf(RoutaInvalidRequestError)
        expect((error as RoutaApiError).code).toBe('idempotency_key_reuse')
        expect((error as RoutaApiError).statusCode).toBe(409)
      })

      it('409 idempotency_in_progress — two concurrent sends racing the same key', async () => {
        const { apiKey, channelId, to } = requireChannelFixture()
        const routa = new Routa({ apiKey, baseURL: BASE_URL, maxRetries: 0 })
        const idempotencyKey = `conformance-inflight-${crypto.randomUUID()}`
        const body = {
          channel: channelId,
          to,
          text: 'racing the same key',
          idempotencyKey,
        }

        const [first, second] = await Promise.allSettled([
          routa.messages.send(body),
          routa.messages.send(body),
        ])

        const rejected = [first, second].find(
          (r): r is PromiseRejectedResult => r.status === 'rejected'
        )
        // Both requests can also legitimately both succeed (one a replay of the
        // other) if the winner finishes before the loser's claim attempt lands
        // — the same race the reference API's own idempotency e2e suite documents. This
        // assertion only fires when a loser was actually observed, and when it
        // is, it must be the specific `idempotency_in_progress` conflict.
        if (rejected) {
          expect(rejected.reason).toBeInstanceOf(RoutaApiError)
          expect(rejected.reason).not.toBeInstanceOf(RoutaInvalidRequestError)
          expect(rejected.reason.code).toBe('idempotency_in_progress')
          expect(rejected.reason.statusCode).toBe(409)
        } else {
          expect(first.status).toBe('fulfilled')
          expect(second.status).toBe('fulfilled')
        }
      })
    }
  )
})
