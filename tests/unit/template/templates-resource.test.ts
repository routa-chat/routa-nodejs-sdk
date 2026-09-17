import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type {
  HttpClient,
  HttpRequestOptions,
} from '../../../src/http/http-client'
import { toTemplateId } from '../../../src/template/template-id'
import type { RawTemplate } from '../../../src/template/template-mapper'
import { TemplatesResource } from '../../../src/template/templates-resource'

const OPENAPI_SNAPSHOT_PATH = join(
  __dirname,
  '../../../docs/reference/openapi-v1.snapshot.json'
)

const openApiSnapshot: {
  paths: Record<
    string,
    Record<
      string,
      {
        requestBody?: {
          content: {
            'application/json': {
              schema: {
                properties: Record<string, unknown>
                required: string[]
              }
            }
          }
        }
      }
    >
  >
} = JSON.parse(readFileSync(OPENAPI_SNAPSHOT_PATH, 'utf-8'))

const SUBMIT_TEMPLATE_REQUEST_SCHEMA =
  openApiSnapshot.paths['/v1/templates']?.['post']?.requestBody?.content[
    'application/json'
  ].schema

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

const TEMPLATE_ID = 'tmpl_01J8XA1B2C3D4E5F6G7H8J9K0M'

function rawTemplate(overrides: Partial<RawTemplate>): RawTemplate {
  return {
    id: TEMPLATE_ID,
    channel: 'chan_01J8XA1B2C3D4E5F6G7H8J9K0M',
    name: 'order_confirmation',
    language: 'en_US',
    category: 'utility',
    variables: [{ index: 1 }, { index: 2 }],
    status: 'submitted',
    rejection_reason: null,
    created_at: '2026-09-12T12:00:00.000Z',
    updated_at: '2026-09-12T12:00:00.000Z',
    ...overrides,
  }
}

describe('submit() — serialization', () => {
  it('is validated against the real requestBody schema in the OpenAPI snapshot', () => {
    expect(SUBMIT_TEMPLATE_REQUEST_SCHEMA).toBeDefined()
    expect(SUBMIT_TEMPLATE_REQUEST_SCHEMA?.required).toEqual([
      'channel',
      'name',
      'language',
      'category',
      'body_text',
    ])
    expect(
      Object.keys(SUBMIT_TEMPLATE_REQUEST_SCHEMA?.properties ?? {})
    ).toEqual(['channel', 'name', 'language', 'category', 'body_text'])
  })

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
      variables: [{ index: 1 }, { index: 2 }],
      status: 'submitted',
      rejectionReason: null,
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
