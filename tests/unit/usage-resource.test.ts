import { describe, expect, it, vi } from 'vitest'
import type { HttpClient, HttpRequestOptions } from '../../src/http/http-client'
import { UsageResource } from '../../src/usage-resource'

function fakeHttpClient(
  requestSpy: (options: HttpRequestOptions) => unknown
): HttpClient {
  return {
    request: <T>(options: HttpRequestOptions): Promise<T> =>
      Promise.resolve(requestSpy(options)) as Promise<T>,
    requestWithHeaders: async <T>(
      options: HttpRequestOptions
    ): Promise<{ data: T; headers: Headers }> => ({
      data: (await requestSpy(options)) as T,
      headers: new Headers(),
    }),
  }
}

describe('UsageResource.retrieve()', () => {
  it('sends from/to as required query params', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      from_date: '2026-09-01',
      to_date: '2026-09-12',
      data: [],
    })
    const resource = new UsageResource(fakeHttpClient(requestSpy))

    await resource.retrieve({ from: '2026-09-01', to: '2026-09-12' })

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/usage',
      searchParams: { from: '2026-09-01', to: '2026-09-12' },
    })
  })

  it('returns a parsed Usage, mapping each record to camelCase', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      from_date: '2026-09-01',
      to_date: '2026-09-12',
      data: [
        {
          metric: 'messages_sent',
          channel_type: 'whatsapp',
          provider: 'meta',
          quantity: 128,
          unit: 'messages',
        },
        {
          metric: 'storage_bytes',
          channel_type: null,
          provider: null,
          quantity: 4096,
          unit: 'bytes',
        },
      ],
    })
    const resource = new UsageResource(fakeHttpClient(requestSpy))

    const usage = await resource.retrieve({
      from: '2026-09-01',
      to: '2026-09-12',
    })

    expect(usage).toEqual({
      fromDate: '2026-09-01',
      toDate: '2026-09-12',
      data: [
        {
          metric: 'messages_sent',
          channelType: 'whatsapp',
          provider: 'meta',
          quantity: 128,
          unit: 'messages',
        },
        {
          metric: 'storage_bytes',
          channelType: null,
          provider: null,
          quantity: 4096,
          unit: 'bytes',
        },
      ],
    })
  })
})
