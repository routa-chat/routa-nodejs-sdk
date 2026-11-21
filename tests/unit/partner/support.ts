import { RoutaPartner } from '../../../src/partner'

export const PARTNER_KEY = 'rt_partner_0123456789abcdefABCDEF0123456789'
export const PROJECT_ID = 'proj_01J8XA1B2C3D4E5F6G7H8J9K0M'
export const KEY_ID = 'key_01J8XA1B2C3D4E5F6G7H8J9K0M'
export const CHANNEL_ID = 'chan_01J8XA1B2C3D4E5F6G7H8J9K0M'

export interface RecordedRequest {
  readonly url: URL
  readonly method: string
  readonly headers: Headers
  readonly body: string | undefined
}

export interface FakeResponse {
  readonly status: number
  /** Serialized as JSON; omit for an empty body (`204`). */
  readonly body?: unknown
  readonly headers?: Record<string, string>
}

/** A `fetch` that answers from a script, in order, and records every request it receives. */
export function scriptedFetch(responses: readonly FakeResponse[]): {
  fetch: typeof fetch
  requests: RecordedRequest[]
} {
  const requests: RecordedRequest[] = []
  const queue = [...responses]
  const fakeFetch: typeof fetch = async (input, init) => {
    const response = queue.shift()
    if (response === undefined) {
      throw new Error('scriptedFetch: more requests than scripted responses')
    }
    requests.push({
      url: new URL(String(input)),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? init.body : undefined,
    })
    return new Response(
      response.body === undefined ? null : JSON.stringify(response.body),
      {
        status: response.status,
        ...(response.headers !== undefined
          ? { headers: response.headers }
          : {}),
      }
    )
  }
  return { fetch: fakeFetch, requests }
}

/** A `RoutaPartner` wired to a scripted `fetch`, with retries off so a scripted failure is the final answer. */
export function partnerWith(responses: readonly FakeResponse[]): {
  partner: RoutaPartner
  requests: RecordedRequest[]
} {
  const { fetch, requests } = scriptedFetch(responses)
  const partner = new RoutaPartner({
    partnerKey: PARTNER_KEY,
    baseURL: 'http://api.test',
    maxRetries: 0,
    fetch,
  })
  return { partner, requests }
}

export function errorEnvelope(
  type: string,
  code: string,
  message: string,
  details?: Record<string, string | number>
): { error: Record<string, unknown> } {
  return {
    error: {
      type,
      code,
      message,
      request_id: 'req_test',
      ...(details !== undefined ? { details } : {}),
    },
  }
}

export const RAW_PROJECT = {
  id: PROJECT_ID,
  name: 'Loja do Zé',
  external_ref: 'lead_123',
  environment: 'live',
  created_at: '2026-11-20T12:00:00.000Z',
} as const
