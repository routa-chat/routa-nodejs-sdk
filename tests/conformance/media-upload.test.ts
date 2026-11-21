import { describe, expect, it } from 'vitest'
import { Routa } from '../../src/client'
import { RoutaInvalidRequestError } from '../../src/domain/errors/routa-invalid-request-error'
import { apiReachable, BASE_URL } from './support/environment'
import { provisionSharedApiKey } from './support/provisioning'

/**
 * Media upload, end to end against a real, locally running API instance — no
 * mocked `fetch` stands in for the server. Skipped, never faked, when that
 * instance is not reachable. The file signs up one organization/project (shared
 * by every scenario below) and issues its own key per scenario.
 *
 * Uploading by `sourceUrl` needs a URL the API is allowed to fetch — and it
 * refuses private and loopback addresses, so a local file server will not do.
 * Point `ROUTA_TEST_MEDIA_SOURCE_URL` at a small public PNG or JPEG to run that
 * scenario; without it, it is skipped.
 */
const MEDIA_SOURCE_URL = process.env['ROUTA_TEST_MEDIA_SOURCE_URL']

/** A real 1×1 PNG: the API checks the file's first bytes against the declared type, so a stand-in string would be rejected. */
const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  )
)

async function mediaClient(
  scopes: readonly string[] = ['media:write', 'media:read']
): Promise<Routa> {
  const { apiKey } = await provisionSharedApiKey(BASE_URL, scopes)
  return new Routa({
    apiKey: apiKey.secret,
    baseURL: BASE_URL,
    maxRetries: 0,
  })
}

describe.skipIf(!apiReachable)('media upload — real API server', () => {
  it('uploading bytes returns a ready Media that retrieve() finds', async () => {
    const routa = await mediaClient()

    const uploaded = await routa.media.upload({
      file: PNG_1X1,
      contentType: 'image/png',
    })

    expect(uploaded.id).toMatch(/^med_/)
    expect(uploaded.contentType).toBe('image/png')
    expect(uploaded.status).toBe('ready')
    expect(uploaded.url).toEqual(expect.any(String))

    const retrieved = await routa.media.retrieve(uploaded.id)
    expect(retrieved.id).toBe(uploaded.id)
    expect(retrieved.contentType).toBe('image/png')
  })

  it('uploading a Blob works the same as uploading bytes', async () => {
    const routa = await mediaClient()

    const uploaded = await routa.media.upload({
      file: new Blob([PNG_1X1]),
      contentType: 'image/png',
    })

    expect(uploaded.status).toBe('ready')
    expect((await routa.media.retrieve(uploaded.id)).id).toBe(uploaded.id)
  })

  it.skipIf(MEDIA_SOURCE_URL === undefined)(
    'uploading by sourceUrl returns a Media that retrieve() finds',
    async () => {
      const routa = await mediaClient()

      const uploaded = await routa.media.upload({
        sourceUrl: MEDIA_SOURCE_URL ?? '',
      })

      expect(uploaded.id).toMatch(/^med_/)
      expect(uploaded.status).toBe('ready')
      expect((await routa.media.retrieve(uploaded.id)).id).toBe(uploaded.id)
    }
  )

  it('422 media_content_type_rejected — a content type WhatsApp does not support', async () => {
    const routa = await mediaClient()

    const error = await routa.media
      .upload({ file: PNG_1X1, contentType: 'application/x-msdownload' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    const apiError = error as RoutaInvalidRequestError
    expect(apiError.statusCode).toBe(422)
    expect(apiError.code).toBe('media_content_type_rejected')
    expect(apiError.requestId).toBeTruthy()
  })

  it('422 media_content_type_rejected — bytes that do not match the declared type', async () => {
    const routa = await mediaClient()

    // PNG bytes declared as a PDF: the type is supported, but the content is not that type.
    const error = await routa.media
      .upload({ file: PNG_1X1, contentType: 'application/pdf' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    expect((error as RoutaInvalidRequestError).statusCode).toBe(422)
    expect((error as RoutaInvalidRequestError).code).toBe(
      'media_content_type_rejected'
    )
  })

  it('422 media_source_blocked — a sourceUrl on a loopback address', async () => {
    const routa = await mediaClient()

    const error = await routa.media
      .upload({ sourceUrl: 'http://127.0.0.1:9/photo.png' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    expect((error as RoutaInvalidRequestError).statusCode).toBe(422)
    expect((error as RoutaInvalidRequestError).code).toBe(
      'media_source_blocked'
    )
  })

  it('422 media_source_url_invalid — an empty sourceUrl', async () => {
    const routa = await mediaClient()

    const error = await routa.media
      .upload({ sourceUrl: '' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    expect((error as RoutaInvalidRequestError).statusCode).toBe(422)
    expect((error as RoutaInvalidRequestError).code).toBe(
      'media_source_url_invalid'
    )
  })

  it('403 insufficient_scope — a key issued without media:write', async () => {
    const routa = await mediaClient(['media:read'])

    const error = await routa.media
      .upload({ file: PNG_1X1, contentType: 'image/png' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    expect((error as RoutaInvalidRequestError).statusCode).toBe(403)
    expect((error as RoutaInvalidRequestError).code).toBe('insufficient_scope')
  })
})
