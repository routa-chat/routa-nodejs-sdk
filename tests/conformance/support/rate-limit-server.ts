import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * A real local HTTP server — the SDK talks to it over a real socket via
 * `fetch`, exactly like it would talk to a real API instance — that
 * reproduces the exact `429` envelope and `Retry-After`/`RateLimit-*`
 * headers a real, exhausted rate-limit bucket returns. The SDK's
 * conformance-suite documentation allows this specific substitution for the
 * "sustained 429" edge case: a real API instance's token bucket refills
 * continuously, so holding it exhausted
 * for the whole span of a client's retry loop would mean flooding a shared
 * development database with concurrent traffic for the entire test — this
 * server reproduces the same wire contract deterministically instead,
 * without touching real project quotas.
 */
export interface RateLimitScriptStep {
  readonly status: 429 | 202
  readonly retryAfterSeconds?: number
}

export interface RunningRateLimitServer {
  readonly baseUrl: string
  readonly requestTimestamps: readonly number[]
  readonly idempotencyKeysSeen: readonly (string | undefined)[]
  close(): Promise<void>
}

/**
 * Serves `POST /v1/messages` according to `script`, one step per request in
 * order; requests beyond the script's length repeat the last step. Every
 * other path 404s, since nothing in this suite needs it.
 */
export function startRateLimitServer(
  script: readonly RateLimitScriptStep[]
): Promise<RunningRateLimitServer> {
  const requestTimestamps: number[] = []
  const idempotencyKeysSeen: (string | undefined)[] = []
  let requestCount = 0

  const server: Server = createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/messages') {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { code: 'not_found' } }))
      return
    }

    requestTimestamps.push(Date.now())
    idempotencyKeysSeen.push(headerValue(req, 'idempotency-key'))

    const stepIndex = Math.min(requestCount, script.length - 1)
    const step = script[stepIndex]
    requestCount += 1

    if (!step || step.status === 429) {
      const retryAfterSeconds = step?.retryAfterSeconds ?? 1
      res.writeHead(429, {
        'content-type': 'application/json',
        'retry-after': String(retryAfterSeconds),
        'ratelimit-limit': '50',
        'ratelimit-remaining': '0',
        'ratelimit-reset': String(retryAfterSeconds),
        'routa-request-id': `req_test_${requestCount}`,
      })
      res.end(
        JSON.stringify({
          error: {
            type: 'rate_limit_error',
            code: 'rate_limit_exceeded',
            message: `Rate limit exceeded for sends. Retry after ${retryAfterSeconds} second(s).`,
            request_id: `req_test_${requestCount}`,
          },
        })
      )
      return
    }

    res.writeHead(202, {
      'content-type': 'application/json',
      'ratelimit-limit': '50',
      'ratelimit-remaining': '10',
      'ratelimit-reset': '1',
      'routa-request-id': `req_test_${requestCount}`,
    })
    res.end(
      JSON.stringify({
        id: 'msg_test0000000000000000000001',
        channel: 'chan_test0000000000000000000001',
        direction: 'outbound',
        from: '+15550001111',
        to: '+15550002222',
        content: { type: 'text', body: 'rate limit conformance probe' },
        status: 'accepted',
        metadata: {},
        accepted_at: new Date().toISOString(),
        sent_at: null,
        delivered_at: null,
        read_at: null,
        failed_at: null,
      })
    )
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        requestTimestamps,
        idempotencyKeysSeen,
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close(err => (err ? rejectClose(err) : resolveClose()))
          }),
      })
    })
  })
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}
