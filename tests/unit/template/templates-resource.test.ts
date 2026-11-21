import { describe, expect, it, vi } from 'vitest'
import { resolveConfig } from '../../../src/config'
import { RoutaInvalidRequestError } from '../../../src/domain/errors/routa-invalid-request-error'
import {
  createHttpClient,
  type HttpClient,
  type HttpRequestOptions,
  type HttpResponse,
} from '../../../src/http/http-client'
import { toTemplateId } from '../../../src/template/template-id'
import type { RawTemplate } from '../../../src/template/template-mapper'
import { toTemplateMediaId } from '../../../src/template/template-media-id'
import type { RawTemplateMedia } from '../../../src/template/template-media-mapper'
import { TemplatesResource } from '../../../src/template/templates-resource'

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

const TEMPLATE_ID = 'tmpl_01J8XA1B2C3D4E5F6G7H8J9K0M'

function rawTemplate(overrides: Partial<RawTemplate>): RawTemplate {
  return {
    id: TEMPLATE_ID,
    channel: 'chan_01J8XA1B2C3D4E5F6G7H8J9K0M',
    name: 'order_confirmation',
    language: 'en_US',
    category: 'utility',
    body_text: 'Your order {{1}} shipped on {{2}}.',
    variables: [{ index: 1 }, { index: 2 }],
    status: 'submitted',
    rejection_reason: null,
    failure_code: null,
    failure_detail: null,
    deletion_requested: false,
    deletion_failure_detail: null,
    origin: 'routa',
    read_only: false,
    unsupported_components: [],
    created_at: '2026-09-12T12:00:00.000Z',
    updated_at: '2026-09-12T12:00:00.000Z',
    ...overrides,
  }
}

describe('submit() — serialization', () => {
  it('produces exactly the documented body', async () => {
    const requestSpy = vi.fn().mockResolvedValue(rawTemplate({}))
    const resource = new TemplatesResource(fakeHttpClient(requestSpy))

    await resource.submit({
      channel: 'chan_1',
      name: 'order_confirmation',
      language: 'en_US',
      category: 'utility',
      bodyText: 'Your order {{1}} shipped on {{2}}.',
    })

    const [options] = requestSpy.mock.calls[0] as [HttpRequestOptions]
    expect(options.method).toBe('POST')
    expect(options.path).toBe('/v1/templates')
    expect(options.body).toEqual({
      channel: 'chan_1',
      name: 'order_confirmation',
      language: 'en_US',
      category: 'utility',
      body_text: 'Your order {{1}} shipped on {{2}}.',
    })
  })

  it('never marks the call idempotency-key eligible — only messages.send() qualifies', async () => {
    const requestSpy = vi.fn().mockResolvedValue(rawTemplate({}))
    const resource = new TemplatesResource(fakeHttpClient(requestSpy))

    await resource.submit({
      channel: 'chan_1',
      name: 'n',
      language: 'en_US',
      category: 'marketing',
      bodyText: 'hi',
    })

    const [options] = requestSpy.mock.calls[0] as [HttpRequestOptions]
    expect(options.idempotencyKeyEligible).toBeUndefined()
  })

  it('returns a parsed Template', async () => {
    const requestSpy = vi.fn().mockResolvedValue(rawTemplate({}))
    const resource = new TemplatesResource(fakeHttpClient(requestSpy))

    const template = await resource.submit({
      channel: 'chan_1',
      name: 'n',
      language: 'en_US',
      category: 'utility',
      bodyText: 'hi',
    })

    expect(template).toEqual({
      id: TEMPLATE_ID,
      channel: 'chan_01J8XA1B2C3D4E5F6G7H8J9K0M',
      name: 'order_confirmation',
      language: 'en_US',
      category: 'utility',
      bodyText: 'Your order {{1}} shipped on {{2}}.',
      variables: [{ index: 1 }, { index: 2 }],
      status: 'submitted',
      rejectionReason: null,
      failureCode: null,
      failureDetail: null,
      deletionRequested: false,
      deletionFailureDetail: null,
      origin: 'routa',
      readOnly: false,
      unsupportedComponents: [],
      createdAt: '2026-09-12T12:00:00.000Z',
      updatedAt: '2026-09-12T12:00:00.000Z',
    })
  })
})

describe('retrieve()', () => {
  it('calls GET /v1/templates/:id', async () => {
    const requestSpy = vi.fn().mockResolvedValue(rawTemplate({}))
    const resource = new TemplatesResource(fakeHttpClient(requestSpy))

    await resource.retrieve(toTemplateId(TEMPLATE_ID))

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: `/v1/templates/${TEMPLATE_ID}`,
    })
  })

  it('parses a rejected template with its rejection reason', async () => {
    const requestSpy = vi
      .fn()
      .mockResolvedValue(
        rawTemplate({ status: 'rejected', rejection_reason: 'scam' })
      )
    const resource = new TemplatesResource(fakeHttpClient(requestSpy))

    const template = await resource.retrieve(toTemplateId(TEMPLATE_ID))

    expect(template.status).toBe('rejected')
    expect(template.rejectionReason).toBe('scam')
  })
})

describe('list()', () => {
  it('is consumable as an async iterator', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      data: [rawTemplate({ id: 'tmpl_1' })],
      has_more: false,
      next_cursor: null,
    })
    const resource = new TemplatesResource(fakeHttpClient(requestSpy))

    const collected: string[] = []
    for await (const template of resource.list()) {
      collected.push(template.id)
    }

    expect(collected).toEqual(['tmpl_1'])
  })

  it('forwards channel/limit/cursor as query params', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      data: [],
      has_more: false,
      next_cursor: null,
    })
    const resource = new TemplatesResource(fakeHttpClient(requestSpy))

    await resource
      .list({ channel: 'chan_1', limit: 10, cursor: 'start' })
      .page()

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/templates',
      searchParams: { channel: 'chan_1', limit: '10', cursor: 'start' },
    })
  })

  it('fetches multiple pages automatically when has_more is true', async () => {
    const requestSpy = vi
      .fn()
      .mockResolvedValueOnce({
        data: [rawTemplate({ id: 'tmpl_1' })],
        has_more: true,
        next_cursor: 'cursor_a',
      })
      .mockResolvedValueOnce({
        data: [rawTemplate({ id: 'tmpl_2' })],
        has_more: false,
        next_cursor: null,
      })
    const resource = new TemplatesResource(fakeHttpClient(requestSpy))

    const collected: string[] = []
    for await (const template of resource.list()) {
      collected.push(template.id)
    }

    expect(collected).toEqual(['tmpl_1', 'tmpl_2'])
    expect(requestSpy).toHaveBeenCalledTimes(2)
  })
})

describe('submit() — components', () => {
  it('sends components in the API body and reads the same ones back', async () => {
    const media = toTemplateMediaId('tmedia_01J8XA1B2C3D4E5F6G7H8J9K0M')
    const requestSpy = vi.fn().mockResolvedValue(
      rawTemplate({
        components: {
          header: { kind: 'media', format: 'image', media_id: media },
          footer: { text: 'Reply STOP to opt out' },
          buttons: [
            { kind: 'quick_reply', text: 'Thanks' },
            { kind: 'url', text: 'Track', url: 'https://example.com/track' },
          ],
        },
      })
    )
    const resource = new TemplatesResource(fakeHttpClient(requestSpy))

    const template = await resource.submit({
      channel: 'chan_1',
      name: 'order_confirmation',
      language: 'en_US',
      category: 'utility',
      bodyText: 'Your order {{1}} shipped on {{2}}.',
      components: {
        header: { kind: 'media', mediaId: media },
        footer: { text: 'Reply STOP to opt out' },
        buttons: [
          { kind: 'quick_reply', text: 'Thanks' },
          { kind: 'url', text: 'Track', url: 'https://example.com/track' },
        ],
      },
    })

    const [options] = requestSpy.mock.calls[0] as [HttpRequestOptions]
    expect(options.body).toMatchObject({
      components: {
        header: { kind: 'media', media_id: media },
        footer: { text: 'Reply STOP to opt out' },
        buttons: [
          { kind: 'quick_reply', text: 'Thanks' },
          { kind: 'url', text: 'Track', url: 'https://example.com/track' },
        ],
      },
    })
    expect(options.idempotencyKeyEligible).toBeUndefined()
    expect(template.status).toBe('submitted')
    expect(template.components).toEqual({
      header: { kind: 'media', format: 'image', media_id: media },
      footer: { text: 'Reply STOP to opt out' },
      buttons: [
        { kind: 'quick_reply', text: 'Thanks' },
        { kind: 'url', text: 'Track', url: 'https://example.com/track' },
      ],
    })
  })

  it('reads components back from retrieve() and list() too', async () => {
    const components = { footer: { text: 'f' } }
    const requestSpy = vi
      .fn()
      .mockResolvedValueOnce(rawTemplate({ components }))
      .mockResolvedValueOnce({
        data: [rawTemplate({ id: 'tmpl_1', components })],
        has_more: false,
        next_cursor: null,
      })
    const resource = new TemplatesResource(fakeHttpClient(requestSpy))

    const retrieved = await resource.retrieve(toTemplateId(TEMPLATE_ID))
    const page = await resource.list().page()

    expect(retrieved.components).toEqual(components)
    expect(page.data[0]?.components).toEqual(components)
  })
})

// No example bodies exist in the OpenAPI snapshot (schemas only), so this is
// built by hand from what the `POST /v1/templates/media` 201 schema allows:
// `id`, `content_type` strings, `format` one of image/video/document,
// `size_bytes` a number, `created_at` a date-time string.
const MEDIA_RESPONSE: RawTemplateMedia = {
  id: 'tmedia_01J8XA1B2C3D4E5F6G7H8J9K0M',
  format: 'image',
  size_bytes: 8,
  content_type: 'image/png',
  created_at: '2026-11-21T12:00:00.000Z',
}

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

describe('uploadMedia()', () => {
  it('POSTs /v1/templates/media with the bytes as a raw body under the given content type', async () => {
    const requestSpy = vi.fn().mockResolvedValue(MEDIA_RESPONSE)
    const resource = new TemplatesResource(fakeHttpClient(requestSpy))

    await resource.uploadMedia({ file: PNG_BYTES, contentType: 'image/png' })

    expect(requestSpy).toHaveBeenCalledTimes(1)
    expect(requestSpy).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/templates/media',
      rawBody: { data: PNG_BYTES, contentType: 'image/png' },
    })
  })

  it('passes a Blob through untouched, ignoring its own type in favour of contentType', async () => {
    const requestSpy = vi.fn().mockResolvedValue(MEDIA_RESPONSE)
    const resource = new TemplatesResource(fakeHttpClient(requestSpy))
    const blob = new Blob([PNG_BYTES], { type: 'application/octet-stream' })

    await resource.uploadMedia({ file: blob, contentType: 'image/png' })

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/templates/media',
      rawBody: { data: blob, contentType: 'image/png' },
    })
  })

  it('does not mark the call idempotency-eligible (the route ignores Idempotency-Key)', async () => {
    const requestSpy = vi.fn().mockResolvedValue(MEDIA_RESPONSE)
    const resource = new TemplatesResource(fakeHttpClient(requestSpy))

    await resource.uploadMedia({ file: PNG_BYTES, contentType: 'image/png' })

    const options = requestSpy.mock.calls[0]?.[0]
    expect(options).not.toHaveProperty('idempotencyKeyEligible')
    expect(options).not.toHaveProperty('idempotencyKey')
  })

  it('returns a parsed TemplateMedia', async () => {
    const requestSpy = vi.fn().mockResolvedValue(MEDIA_RESPONSE)
    const resource = new TemplatesResource(fakeHttpClient(requestSpy))

    const media = await resource.uploadMedia({
      file: PNG_BYTES,
      contentType: 'image/png',
    })

    expect(media).toEqual({
      id: 'tmedia_01J8XA1B2C3D4E5F6G7H8J9K0M',
      format: 'image',
      sizeBytes: 8,
      contentType: 'image/png',
      createdAt: '2026-11-21T12:00:00.000Z',
    })
  })
})

describe('errors from the templates endpoints', () => {
  function resourceAnswering(
    status: number,
    error: object
  ): {
    resource: TemplatesResource
    fetchSpy: ReturnType<typeof vi.fn<typeof fetch>>
  } {
    const fetchSpy = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify({ error }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
    )
    const http = createHttpClient(
      resolveConfig({ apiKey: 'rt_test_123', fetch: fetchSpy, maxRetries: 0 })
    )
    return { resource: new TemplatesResource(http), fetchSpy }
  }

  const SUBMIT = {
    channel: 'chan_1',
    name: 'n',
    language: 'en_US',
    category: 'utility',
    bodyText: 'hi',
    components: {
      buttons: [{ kind: 'url', text: 'Track', url: 'not a url' }],
    },
  } as const

  it('delivers the 422 `param` of a refused component in RoutaInvalidRequestError.param', async () => {
    // What the API sends: `param` names the component, not the item inside it.
    const { resource } = resourceAnswering(422, {
      type: 'invalid_request_error',
      code: 'template_components_invalid',
      message: 'A URL button requires a URL.',
      param: 'components.buttons',
      request_id: 'req_1',
    })

    const error = await resource.submit(SUBMIT).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    const apiError = error as RoutaInvalidRequestError
    expect(apiError.statusCode).toBe(422)
    expect(apiError.code).toBe('template_components_invalid')
    expect(apiError.param).toBe('components.buttons')
  })

  it('delivers the template name `param` too', async () => {
    const { resource } = resourceAnswering(422, {
      type: 'invalid_request_error',
      code: 'template_name_invalid',
      message: 'bad name',
      param: 'name',
      request_id: 'req_1',
    })

    const error = await resource.submit(SUBMIT).catch((e: unknown) => e)

    expect((error as RoutaInvalidRequestError).param).toBe('name')
  })

  it('maps 404 template_media_not_found to RoutaInvalidRequestError, without a param', async () => {
    const { resource } = resourceAnswering(404, {
      type: 'not_found_error',
      code: 'template_media_not_found',
      message: 'Template media tmedia_x was not found.',
      request_id: 'req_1',
    })

    const error = await resource
      .submit({
        ...SUBMIT,
        components: {
          header: {
            kind: 'media',
            mediaId: toTemplateMediaId('tmedia_01J8XA1B2C3D4E5F6G7H8J9K0M'),
          },
        },
      })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    const apiError = error as RoutaInvalidRequestError
    expect(apiError.statusCode).toBe(404)
    expect(apiError.code).toBe('template_media_not_found')
    expect(apiError.param).toBeUndefined()
  })

  it('maps 422 template_media_invalid from uploadMedia() to RoutaInvalidRequestError', async () => {
    const { resource } = resourceAnswering(422, {
      type: 'invalid_request_error',
      code: 'template_media_invalid',
      message:
        'Content type "image/gif" is not a supported template header media type.',
      request_id: 'req_1',
    })

    const error = await resource
      .uploadMedia({ file: PNG_BYTES, contentType: 'image/gif' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoutaInvalidRequestError)
    expect((error as RoutaInvalidRequestError).code).toBe(
      'template_media_invalid'
    )
    expect((error as RoutaInvalidRequestError).param).toBeUndefined()
  })

  it('does not retry a 413 from uploadMedia(), and it stays a base RoutaApiError', async () => {
    const { resource, fetchSpy } = resourceAnswering(413, {
      type: 'invalid_request_error',
      code: 'payload_too_large',
      message: 'too big',
      request_id: 'req_1',
    })

    const error = await resource
      .uploadMedia({ file: PNG_BYTES, contentType: 'image/png' })
      .catch((e: unknown) => e)

    expect(error).not.toBeInstanceOf(RoutaInvalidRequestError)
    expect((error as { statusCode: number }).statusCode).toBe(413)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
