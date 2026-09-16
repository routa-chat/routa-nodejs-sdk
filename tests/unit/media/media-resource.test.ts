import { describe, expect, it, vi } from 'vitest'
import type {
  HttpClient,
  HttpRequestOptions,
} from '../../../src/http/http-client'
import { toMediaId } from '../../../src/media/media-id'
import type { RawMedia } from '../../../src/media/media-mapper'
import { MediaResource } from '../../../src/media/media-resource'

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

const MEDIA_ID = 'med_01J8XA1B2C3D4E5F6G7H8J9K0M'

function rawMedia(overrides: Partial<RawMedia>): RawMedia {
  return {
    id: MEDIA_ID,
    content_type: 'image/png',
    status: 'ready',
    url: 'https://cdn.routa.chat/media/signed-url',
    ...overrides,
  }
}

describe('MediaResource.retrieve()', () => {
  it('calls GET /v1/media/:id', async () => {
    const requestSpy = vi.fn().mockResolvedValue(rawMedia({}))
    const resource = new MediaResource(fakeHttpClient(requestSpy))

    await resource.retrieve(toMediaId(MEDIA_ID))

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: `/v1/media/${MEDIA_ID}`,
    })
  })

  it('returns a parsed Media', async () => {
    const requestSpy = vi.fn().mockResolvedValue(rawMedia({}))
    const resource = new MediaResource(fakeHttpClient(requestSpy))

    const media = await resource.retrieve(toMediaId(MEDIA_ID))

    expect(media).toEqual({
      id: MEDIA_ID,
      contentType: 'image/png',
      status: 'ready',
      url: 'https://cdn.routa.chat/media/signed-url',
    })
  })

  it.each(['pending', 'ready', 'unavailable'] as const)(
    'parses status %s as-is',
    async status => {
      const requestSpy = vi
        .fn()
        .mockResolvedValue(
          rawMedia({ status, url: status === 'ready' ? 'https://x' : null })
        )
      const resource = new MediaResource(fakeHttpClient(requestSpy))

      const media = await resource.retrieve(toMediaId(MEDIA_ID))

      expect(media.status).toBe(status)
    }
  )

  it('parses a null url when media is not ready', async () => {
    const requestSpy = vi
      .fn()
      .mockResolvedValue(rawMedia({ status: 'pending', url: null }))
    const resource = new MediaResource(fakeHttpClient(requestSpy))

    const media = await resource.retrieve(toMediaId(MEDIA_ID))

    expect(media.url).toBeNull()
  })
})
