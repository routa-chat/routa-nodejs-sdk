import { describe, expect, it, vi } from 'vitest'
import type {
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
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
    ): Promise<HttpResponse<T>> => ({
      data: (await requestSpy(options)) as T,
      status: 200,
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

// No example bodies exist in the OpenAPI snapshot (schemas only), so this is
// built by hand from what the `POST /v1/media` 201 schema allows: `id`,
// `content_type` and `status` are strings, `url` a string or null. An upload
// is synchronous, so the real API answers `ready` with a signed `url`.
const UPLOAD_RESPONSE: RawMedia = rawMedia({
  id: 'med_01J8XA1B2C3D4E5F6G7H8J9K0N',
  content_type: 'image/png',
  status: 'ready',
  url: 'https://storage.routa.chat/outbound/signed?sig=abc',
})

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

describe('MediaResource.upload() — file mode', () => {
  it('POSTs /v1/media with the bytes as a raw body under the given content type', async () => {
    const requestSpy = vi.fn().mockResolvedValue(UPLOAD_RESPONSE)
    const resource = new MediaResource(fakeHttpClient(requestSpy))

    await resource.upload({ file: PNG_BYTES, contentType: 'image/png' })

    expect(requestSpy).toHaveBeenCalledTimes(1)
    expect(requestSpy).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/media',
      rawBody: { data: PNG_BYTES, contentType: 'image/png' },
    })
  })

  it('passes a Blob through untouched, ignoring its own type in favour of contentType', async () => {
    const requestSpy = vi.fn().mockResolvedValue(UPLOAD_RESPONSE)
    const resource = new MediaResource(fakeHttpClient(requestSpy))
    const blob = new Blob([PNG_BYTES], { type: 'application/octet-stream' })

    await resource.upload({ file: blob, contentType: 'image/png' })

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/media',
      rawBody: { data: blob, contentType: 'image/png' },
    })
  })

  it('does not mark the call as idempotency-eligible (the route ignores Idempotency-Key)', async () => {
    const requestSpy = vi.fn().mockResolvedValue(UPLOAD_RESPONSE)
    const resource = new MediaResource(fakeHttpClient(requestSpy))

    await resource.upload({ file: PNG_BYTES, contentType: 'image/png' })

    const options = requestSpy.mock.calls[0]?.[0]
    expect(options).not.toHaveProperty('idempotencyKeyEligible')
    expect(options).not.toHaveProperty('idempotencyKey')
  })

  it('returns a parsed Media', async () => {
    const requestSpy = vi.fn().mockResolvedValue(UPLOAD_RESPONSE)
    const resource = new MediaResource(fakeHttpClient(requestSpy))

    const media = await resource.upload({
      file: PNG_BYTES,
      contentType: 'image/png',
    })

    expect(media).toEqual({
      id: 'med_01J8XA1B2C3D4E5F6G7H8J9K0N',
      contentType: 'image/png',
      status: 'ready',
      url: 'https://storage.routa.chat/outbound/signed?sig=abc',
    })
  })
})

describe('MediaResource.upload() — sourceUrl mode', () => {
  it('POSTs /v1/media with a JSON { source_url } body', async () => {
    const requestSpy = vi.fn().mockResolvedValue(UPLOAD_RESPONSE)
    const resource = new MediaResource(fakeHttpClient(requestSpy))

    await resource.upload({ sourceUrl: 'https://example.com/photo.png' })

    expect(requestSpy).toHaveBeenCalledTimes(1)
    expect(requestSpy).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/media',
      body: { source_url: 'https://example.com/photo.png' },
    })
  })

  it('returns a parsed Media', async () => {
    const requestSpy = vi.fn().mockResolvedValue(UPLOAD_RESPONSE)
    const resource = new MediaResource(fakeHttpClient(requestSpy))

    const media = await resource.upload({
      sourceUrl: 'https://example.com/photo.png',
    })

    expect(media.id).toBe('med_01J8XA1B2C3D4E5F6G7H8J9K0N')
    expect(media.status).toBe('ready')
  })
})

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
