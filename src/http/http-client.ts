import type { ResolvedRoutaConfig } from '../config'
import { type ErrorEnvelope, mapErrorResponse } from './error-response-mapper'
import { generateIdempotencyKey } from './idempotency-key-generator'
import {
  calculateBackoffDelayMs,
  isRetryableFailure,
  parseRetryAfterMs,
} from './retry-policy'

/** HTTP methods used by the resources this client will eventually expose. */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface HttpRequestOptions {
  readonly method: HttpMethod
  /** Path relative to the configured base URL, e.g. `/v1/messages`. */
  readonly path: string
  readonly body?: unknown
  readonly searchParams?: Record<string, string>
  /**
   * Marks this call as one the real API treats as safe to deduplicate by
   * `Idempotency-Key` — only specific writes qualify, so this defaults to
   * `false` rather than being inferred from the HTTP method.
   */
  readonly idempotencyKeyEligible?: boolean
  /** Caller-supplied key, reused as-is instead of generating one. */
  readonly idempotencyKey?: string
}

/**
 * A request that never got a response — a network failure or a client-side
 * timeout. A request the server did respond to, even with an error, throws
 * the matching `RoutaApiError` subtype instead (see `error-response-mapper`)
 * — this class exists only for the case where there is no HTTP status to
 * classify against.
 */
export class HttpRequestError extends Error {
  readonly status: number | undefined
  readonly code: string | undefined
  readonly requestId: string | null

  constructor(
    message: string,
    details: {
      status: number | undefined
      code: string | undefined
      requestId: string | null
      cause?: unknown
    }
  ) {
    super(
      message,
      details.cause !== undefined ? { cause: details.cause } : undefined
    )
    this.name = 'HttpRequestError'
    this.status = details.status
    this.code = details.code
    this.requestId = details.requestId
  }
}

/** A parsed response body alongside the raw headers it arrived with, for the rare caller that needs a response header (e.g. `Idempotent-Replay`) the parsed body alone doesn't carry. */
export interface HttpResponse<T> {
  readonly data: T
  readonly headers: Headers
}

export interface HttpClient {
  request<T = unknown>(options: HttpRequestOptions): Promise<T>
  requestWithHeaders<T = unknown>(
    options: HttpRequestOptions
  ): Promise<HttpResponse<T>>
}

/** Builds the HTTP client every public resource sends requests through. */
export function createHttpClient(config: ResolvedRoutaConfig): HttpClient {
  async function requestWithHeaders<T = unknown>(
    options: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    const idempotencyKey = resolveIdempotencyKey(options)

    for (let attempt = 0; ; attempt++) {
      const response = await performAttempt(options, idempotencyKey)

      if (response.kind === 'network-failure') {
        if (attempt < config.maxRetries) {
          const delayMs = calculateBackoffDelayMs(attempt)
          config.logger.warn(
            'Routa request failed to reach the server, retrying',
            {
              attempt: attempt + 1,
              delayMs,
            }
          )
          await sleep(delayMs)
          continue
        }
        throw new HttpRequestError(response.message, {
          status: undefined,
          code: undefined,
          requestId: null,
          cause: response.cause,
        })
      }

      const { httpResponse, requestId } = response

      if (httpResponse.ok) {
        return {
          data: await parseSuccessBody<T>(httpResponse),
          headers: httpResponse.headers,
        }
      }

      const envelope = await parseErrorEnvelope(httpResponse)

      if (
        attempt < config.maxRetries &&
        isRetryableFailure(httpResponse.status, envelope.code)
      ) {
        const delayMs =
          parseRetryAfterMs(httpResponse.headers.get('Retry-After')) ??
          calculateBackoffDelayMs(attempt)
        config.logger.warn('Routa request failed, retrying', {
          attempt: attempt + 1,
          status: httpResponse.status,
          delayMs,
        })
        await sleep(delayMs)
        continue
      }

      throw mapErrorResponse(httpResponse.status, envelope, requestId ?? '')
    }
  }

  async function request<T = unknown>(options: HttpRequestOptions): Promise<T> {
    const { data } = await requestWithHeaders<T>(options)
    return data
  }

  async function performAttempt(
    options: HttpRequestOptions,
    idempotencyKey: string | undefined
  ): Promise<
    | { kind: 'network-failure'; message: string; cause: unknown }
    | { kind: 'response'; httpResponse: Response; requestId: string | null }
  > {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeout)

    try {
      const requestInit: RequestInit = {
        method: options.method,
        headers: buildHeaders(
          config.apiKey,
          idempotencyKey,
          options.body !== undefined
        ),
        signal: controller.signal,
      }
      if (options.body !== undefined) {
        requestInit.body = JSON.stringify(options.body)
      }
      const httpResponse = await config.fetch(
        buildUrl(config.baseURL, options),
        requestInit
      )
      return {
        kind: 'response',
        httpResponse,
        requestId: httpResponse.headers.get('Routa-Request-Id'),
      }
    } catch (cause) {
      return {
        kind: 'network-failure',
        message: describeNetworkFailure(cause),
        cause,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  function resolveIdempotencyKey(
    options: HttpRequestOptions
  ): string | undefined {
    if (!options.idempotencyKeyEligible) {
      return options.idempotencyKey
    }
    return options.idempotencyKey ?? generateIdempotencyKey()
  }

  return { request, requestWithHeaders }
}

function buildUrl(baseURL: string, options: HttpRequestOptions): string {
  const base = baseURL.endsWith('/') ? baseURL : `${baseURL}/`
  const url = new URL(options.path.replace(/^\//, ''), base)
  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

function buildHeaders(
  apiKey: string,
  idempotencyKey: string | undefined,
  hasBody: boolean
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  }
  if (hasBody) {
    headers['Content-Type'] = 'application/json'
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey
  }
  return headers
}

async function parseSuccessBody<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text) {
    return undefined as T
  }
  // Single point of parsing HTTP responses into typed values — the one place
  // an `as` is warranted, since a JSON body has no static type of its own.
  return JSON.parse(text) as T
}

/**
 * Real error responses nest everything under an `error` key (confirmed
 * against the SDK's captured OpenAPI snapshot): `{ error: { type,
 * code, message, param?, doc_url?, request_id } }`. `requestId` is read from
 * the `Routa-Request-Id` header elsewhere rather than this body field, since
 * the header is present on every response, success or failure.
 */
interface ErrorResponseBody {
  readonly code?: string
  readonly message?: string
  readonly param?: string
  readonly doc_url?: string
}

async function parseErrorEnvelope(response: Response): Promise<ErrorEnvelope> {
  const body = await parseErrorResponseBody(response)
  const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'))

  return {
    ...(body?.code !== undefined ? { code: body.code } : {}),
    ...(body?.message !== undefined ? { message: body.message } : {}),
    ...(body?.param !== undefined ? { param: body.param } : {}),
    ...(body?.doc_url !== undefined ? { docUrl: body.doc_url } : {}),
    ...(retryAfterMs !== undefined
      ? { retryAfter: Math.round(retryAfterMs / 1000) }
      : {}),
  }
}

async function parseErrorResponseBody(
  response: Response
): Promise<ErrorResponseBody | undefined> {
  try {
    const text = await response.text()
    if (!text) {
      return undefined
    }
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || !('error' in parsed)) {
      return undefined
    }
    const { error } = parsed as { error: unknown }
    // Single point of parsing an HTTP error body into a typed value — the
    // one place an `as` is warranted, since a JSON body has no static type
    // of its own.
    return typeof error === 'object' && error !== null
      ? (error as ErrorResponseBody)
      : undefined
  } catch {
    return undefined
  }
}

function describeNetworkFailure(cause: unknown): string {
  if (cause instanceof DOMException && cause.name === 'AbortError') {
    return 'Routa API request timed out before receiving a response.'
  }
  if (cause instanceof Error) {
    return `Routa API request failed before receiving a response: ${cause.message}`
  }
  return 'Routa API request failed before receiving a response.'
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
