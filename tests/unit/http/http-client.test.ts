import { afterEach, describe, expect, it, vi } from 'vitest'
import { type RoutaConfig, resolveConfig } from '../../../src/config'
import { createHttpClient } from '../../../src/http/http-client'

function buildClient(
  fetchImpl: typeof fetch,
  overrides: Partial<RoutaConfig> = {}
) {
  return createHttpClient(
    resolveConfig({
      apiKey: 'rt_test_123',
      fetch: fetchImpl,
      maxRetries: 3,
      timeout: 30_000,
      ...overrides,
    })
  )
}

function jsonResponse(
  body: unknown,
  headers: Record<string, string> = {},
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function errorResponse(
  status: number,
  code?: string,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(code ? { error: { code } } : {}), {
    status,
    headers,
  })
}

function headerFromCall(
  call: [unknown, (RequestInit | undefined)?] | undefined,
  name: string
): string | undefined {
  const headers = call?.[1]?.headers as Record<string, string> | undefined
  return headers?.[name]
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('request — success path', () => {
  it('sends the API key as a bearer token', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}))
    const client = buildClient(fetchSpy)

    await client.request({ method: 'GET', path: '/v1/whoami' })

    expect(headerFromCall(fetchSpy.mock.calls[0], 'Authorization')).toBe(
      'Bearer rt_test_123'
    )
  })

  it('serializes the body and sets Content-Type for a write', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}))
    const client = buildClient(fetchSpy)

    await client.request({
      method: 'POST',
      path: '/v1/messages',
      body: { channel: 'chan_1', to: '+1', text: 'hi' },
    })

    const [, init] = fetchSpy.mock.calls[0] ?? []
    expect(headerFromCall(fetchSpy.mock.calls[0], 'Content-Type')).toBe(
      'application/json'
    )
    expect(init?.body).toBe(
      JSON.stringify({ channel: 'chan_1', to: '+1', text: 'hi' })
    )
  })

  it('sends no Content-Type or body for a bodyless request', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}))
    const client = buildClient(fetchSpy)

    await client.request({ method: 'GET', path: '/v1/whoami' })

    const [, init] = fetchSpy.mock.calls[0] ?? []
    expect(
      headerFromCall(fetchSpy.mock.calls[0], 'Content-Type')
    ).toBeUndefined()
    expect(init?.body).toBeUndefined()
  })

  it('resolves with the parsed JSON body', async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ id: 'msg_1', status: 'accepted' }))
    const client = buildClient(fetchSpy)

    const result = await client.request({
      method: 'GET',
      path: '/v1/messages/msg_1',
    })

    expect(result).toEqual({ id: 'msg_1', status: 'accepted' })
  })
})

describe('requestWithHeaders', () => {
  it('resolves with both the parsed body and the response headers', async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ id: 'msg_1' }, { 'Idempotent-Replay': 'true' })
      )
    const client = buildClient(fetchSpy)

    const result = await client.requestWithHeaders({
      method: 'GET',
      path: '/v1/messages/msg_1',
    })

    expect(result.data).toEqual({ id: 'msg_1' })
    expect(result.headers.get('Idempotent-Replay')).toBe('true')
  })
})

describe('request — idempotency key', () => {
  it('does not attach Idempotency-Key when the operation is not eligible', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}))
    const client = buildClient(fetchSpy)

    await client.request({ method: 'GET', path: '/v1/whoami' })

    expect(
      headerFromCall(fetchSpy.mock.calls[0], 'Idempotency-Key')
    ).toBeUndefined()
  })

  it('reuses the same Idempotency-Key across every retry of one call', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(jsonResponse({}))
    const client = buildClient(fetchSpy)

    const promise = client.request({
      method: 'POST',
      path: '/v1/messages',
      body: { text: 'hi' },
      idempotencyKeyEligible: true,
    })
    await vi.runAllTimersAsync()
    await promise

    expect(fetchSpy).toHaveBeenCalledTimes(3)
    const keysUsed = fetchSpy.mock.calls.map(call =>
      headerFromCall(call, 'Idempotency-Key')
    )
    expect(keysUsed[0]).toBeTruthy()
    expect(new Set(keysUsed).size).toBe(1)
  })

  it('generates a different key for two independent eligible calls', async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jsonResponse({}))
    const client = buildClient(fetchSpy)

    await client.request({
      method: 'POST',
      path: '/v1/messages',
      body: { text: 'hi' },
      idempotencyKeyEligible: true,
    })
    await client.request({
      method: 'POST',
      path: '/v1/messages',
      body: { text: 'hi' },
      idempotencyKeyEligible: true,
    })

    const [firstCall, secondCall] = fetchSpy.mock.calls
    const firstKey = headerFromCall(firstCall, 'Idempotency-Key')
    const secondKey = headerFromCall(secondCall, 'Idempotency-Key')
    expect(firstKey).toBeTruthy()
    expect(secondKey).toBeTruthy()
    expect(firstKey).not.toBe(secondKey)
  })

  it('uses a caller-supplied key instead of generating one', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}))
    const client = buildClient(fetchSpy)

    await client.request({
      method: 'POST',
      path: '/v1/messages',
      body: { text: 'hi' },
      idempotencyKeyEligible: true,
      idempotencyKey: 'caller-key-123',
    })

    expect(headerFromCall(fetchSpy.mock.calls[0], 'Idempotency-Key')).toBe(
      'caller-key-123'
    )
  })
})

const NON_RETRYABLE_CASES: Array<{
  name: string
  status: number
  code: string | undefined
}> = [
  { name: '401 authentication error', status: 401, code: 'api_key_invalid' },
  { name: '403 insufficient scope', status: 403, code: 'insufficient_scope' },
  { name: '404 not found', status: 404, code: 'message_not_found' },
  {
    name: '409 idempotency_key_reuse',
    status: 409,
    code: 'idempotency_key_reuse',
  },
  { name: '422 invalid request', status: 422, code: 'content_rejected' },
]

describe.each(NON_RETRYABLE_CASES)(
  'request — $name is never retried',
  ({ status, code }) => {
    it('fails on the first attempt and surfaces statusCode/code/requestId', async () => {
      const fetchSpy = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          errorResponse(status, code, { 'Routa-Request-Id': 'req_1' })
        )
      const client = buildClient(fetchSpy)

      await expect(
        client.request({ method: 'POST', path: '/v1/messages' })
      ).rejects.toMatchObject({ statusCode: status, code, requestId: 'req_1' })
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  }
)

const RETRYABLE_HTTP_CASES: Array<{
  name: string
  status: number
  code: string | undefined
}> = [
  {
    name: '409 idempotency_in_progress',
    status: 409,
    code: 'idempotency_in_progress',
  },
  { name: '429 rate limit', status: 429, code: undefined },
  { name: '503 service unavailable', status: 503, code: 'service_unavailable' },
]

describe.each(RETRYABLE_HTTP_CASES)(
  'request — $name is retried',
  ({ status, code }) => {
    it('retries and eventually succeeds', async () => {
      vi.useFakeTimers()
      const fetchSpy = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(errorResponse(status, code))
        .mockResolvedValueOnce(jsonResponse({ ok: true }))
      const client = buildClient(fetchSpy)

      const promise = client.request({ method: 'GET', path: '/v1/whoami' })
      await vi.runAllTimersAsync()

      await expect(promise).resolves.toEqual({ ok: true })
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })
  }
)

describe('request — Retry-After', () => {
  it('waits exactly the delta-seconds Retry-After value before retrying a 429', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        errorResponse(429, undefined, { 'Retry-After': '2' })
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    const client = buildClient(fetchSpy)

    const promise = client.request({ method: 'GET', path: '/v1/whoami' })

    await vi.advanceTimersByTimeAsync(1_999)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    await expect(promise).resolves.toEqual({ ok: true })
  })
})

describe('request — network failures and timeouts', () => {
  it('retries a network failure and eventually succeeds', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    const client = buildClient(fetchSpy)

    const promise = client.request({ method: 'GET', path: '/v1/whoami' })
    await vi.runAllTimersAsync()

    await expect(promise).resolves.toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('treats a client-side timeout as retryable', async () => {
    vi.useFakeTimers()
    let callCount = 0
    const fetchSpy: typeof fetch = vi.fn(
      (
        _input: Parameters<typeof fetch>[0],
        init?: RequestInit
      ): Promise<Response> => {
        callCount++
        if (callCount === 1) {
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(
                new DOMException('The operation was aborted.', 'AbortError')
              )
            })
          })
        }
        return Promise.resolve(jsonResponse({ ok: true }))
      }
    )
    const client = buildClient(fetchSpy, { timeout: 100 })

    const promise = client.request({ method: 'GET', path: '/v1/whoami' })
    await vi.runAllTimersAsync()

    await expect(promise).resolves.toEqual({ ok: true })
    expect(callCount).toBe(2)
  })

  it('throws a distinguishable error once retries are exhausted after a timeout', async () => {
    vi.useFakeTimers()
    const fetchSpy: typeof fetch = vi.fn(
      (
        _input: Parameters<typeof fetch>[0],
        init?: RequestInit
      ): Promise<Response> =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        })
    )
    const client = buildClient(fetchSpy, { timeout: 100, maxRetries: 0 })

    const promise = client.request({ method: 'GET', path: '/v1/whoami' })
    const assertion = expect(promise).rejects.toMatchObject({
      status: undefined,
    })
    await vi.runAllTimersAsync()
    await assertion
    await expect(promise).rejects.toThrow(/timed out/)
  })
})

describe('request — maxRetries', () => {
  it('makes exactly maxRetries + 1 attempts before giving up', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => errorResponse(503))
    const client = buildClient(fetchSpy, { maxRetries: 2 })

    const promise = client.request({ method: 'GET', path: '/v1/whoami' })
    const assertion = expect(promise).rejects.toMatchObject({
      statusCode: 503,
    })
    await vi.runAllTimersAsync()
    await assertion

    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })
})
