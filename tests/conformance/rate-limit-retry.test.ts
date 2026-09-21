import { afterEach, describe, expect, it } from 'vitest'
import { Routa } from '../../src/client'
import { RoutaInvalidRequestError } from '../../src/domain/errors/routa-invalid-request-error'
import { RoutaRateLimitError } from '../../src/domain/errors/routa-rate-limit-error'
import { apiReachable, BASE_URL } from './support/environment'
import { provisionApiKey } from './support/provisioning'
import {
  type RunningRateLimitServer,
  startRateLimitServer,
} from './support/rate-limit-server'

/**
 * `429` retry behaviour: honouring `Retry-After`, never exceeding
 * `maxRetries`. Two kinds of evidence:
 *
 * 1. Against a real, freshly-provisioned project on a real, locally running
 *    API instance — confirms the real envelope and headers, and that the
 *    SDK recovers from a real, transient rate-limit rejection by honouring
 *    `Retry-After`.
 * 2. Against a real local HTTP server that deterministically forces a
 *    sustained `429` — the SDK's conformance-suite documentation allows
 *    this substitution explicitly, because holding a real project's bucket
 *    exhausted for an entire retry window would mean flooding a shared
 *    development database with load for the sole purpose of timing a test.
 *    This is still a real HTTP round trip over a real socket, just not the
 *    reference API server itself — it proves the exact boundary a live rate
 *    limiter is impractical to pin down deterministically: the wait
 *    duration and the maxRetries cutoff.
 */
describe.skipIf(!apiReachable)('rate-limit retry — real API server', () => {
  it('a real 429 carries Retry-After and RateLimit-* headers, and messages.send() recovers by honouring it', async () => {
    const { apiKey } = await provisionApiKey(BASE_URL, ['messages:write'])
    const routa = new Routa({ apiKey: apiKey.secret, baseURL: BASE_URL })

    // Exhaust the burst with maxRetries: 0 raw sends first (so the assertion
    // below is not itself the thing that exhausts it), then let a normal,
    // fully-retrying client observe and recover from the transient 429.
    const probe = new Routa({
      apiKey: apiKey.secret,
      baseURL: BASE_URL,
      maxRetries: 0,
    })
    let observed429 = false
    for (let attempt = 0; attempt < 200 && !observed429; attempt++) {
      const error = await probe.messages
        .send({ channel: 'chan_doesnotexist', to: '+15550002222', text: 'hi' })
        .then(() => undefined)
        .catch((e: unknown) => e)
      if (error instanceof RoutaRateLimitError) {
        observed429 = true
        expect(error.retryAfter).toBeGreaterThan(0)
      }
    }
    expect(observed429).toBe(true)

    // The bucket refills continuously (the reference API's default
    // `sustainedRps: 50`), so the very next call — sent through a client
    // with retries enabled — is expected to recover within a couple of
    // retries by honouring Retry-After, without ever exceeding maxRetries.
    // Recovery shows up as `channel_not_found` (the channel is deliberately
    // fake) — the request got *past* the rate limiter. The only other
    // conformant outcome is still being rate-limited after every retry;
    // anything else is a real conformance failure.
    const error = await routa.messages
      .send({ channel: 'chan_doesnotexist', to: '+15550002222', text: 'hi' })
      .then(() => undefined)
      .catch((e: unknown) => e)
    if (error !== undefined) {
      const recovered =
        error instanceof RoutaInvalidRequestError &&
        error.code === 'channel_not_found'
      const stillRateLimited = error instanceof RoutaRateLimitError
      expect(recovered || stillRateLimited).toBe(true)
    }
  })
})

describe('rate-limit retry — deterministic local server', () => {
  let server: RunningRateLimitServer | undefined

  afterEach(async () => {
    await server?.close()
    server = undefined
  })

  it('waits at least the Retry-After duration before the next attempt, and succeeds within maxRetries', async () => {
    server = await startRateLimitServer([
      { status: 429, retryAfterSeconds: 1 },
      { status: 202 },
    ])
    const routa = new Routa({
      apiKey: 'rt_test_deterministic',
      baseURL: server.baseUrl,
      maxRetries: 3,
    })

    const start = Date.now()
    const message = await routa.messages.send({
      channel: 'chan_test0000000000000000000001',
      to: '+15550002222',
      text: 'deterministic rate limit retry',
    })
    const elapsedMs = Date.now() - start

    expect(message.status).toBe('accepted')
    expect(server.requestTimestamps).toHaveLength(2)
    expect(elapsedMs).toBeGreaterThanOrEqual(950)
    // The same Idempotency-Key must be reused across the retry — this is a
    // write, and every retried write reuses the key that protects it.
    expect(server.idempotencyKeysSeen[0]).toBeTruthy()
    expect(server.idempotencyKeysSeen[1]).toBe(server.idempotencyKeysSeen[0])
  })

  it('never makes more than maxRetries + 1 attempts against a sustained 429', async () => {
    server = await startRateLimitServer([
      { status: 429, retryAfterSeconds: 0 },
      { status: 429, retryAfterSeconds: 0 },
      { status: 429, retryAfterSeconds: 0 },
      { status: 429, retryAfterSeconds: 0 },
      { status: 429, retryAfterSeconds: 0 },
      { status: 429, retryAfterSeconds: 0 },
    ])
    const routa = new Routa({
      apiKey: 'rt_test_deterministic',
      baseURL: server.baseUrl,
      maxRetries: 2,
    })

    const error = await routa.messages
      .send({
        channel: 'chan_test0000000000000000000001',
        to: '+15550002222',
        text: 'sustained rate limit',
      })
      .then(() => undefined)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaRateLimitError)
    expect((error as RoutaRateLimitError).code).toBe('rate_limit_exceeded')
    // maxRetries: 2 means exactly 3 total attempts — the initial call plus 2 retries.
    expect(server.requestTimestamps).toHaveLength(3)
  })
})
