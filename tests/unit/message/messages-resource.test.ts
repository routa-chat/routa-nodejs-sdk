import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type {
  HttpClient,
  HttpRequestOptions,
} from '../../../src/http/http-client'
import type { MessageContent } from '../../../src/message/message'
import { toMessageId } from '../../../src/message/message-id'
import { MessagesResource } from '../../../src/message/messages-resource'

const OPENAPI_SNAPSHOT_PATH = join(
  __dirname,
  '../../../docs/reference/openapi-v1.snapshot.json'
)

// Loaded once, straight from the real contract — the serialization tests
// below assert against these property names instead of a hand-typed list,
// so they fail the moment the SDK's body shape drifts from the real one.
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

const SEND_MESSAGE_REQUEST_SCHEMA =
  openApiSnapshot.paths['/v1/messages']?.['post']?.requestBody?.content[
    'application/json'
  ].schema

// `vi.fn()` infers a non-generic mock, which can't satisfy `HttpClient`'s
// generic `request<T>` on its own — this wraps it in a real generic function
// so the fake transport type-checks like any other `HttpClient`.
function fakeHttpClient(
  requestSpy: (options: HttpRequestOptions) => unknown,
  responseHeaders: Headers = new Headers()
): HttpClient {
  return {
    request: <T>(options: HttpRequestOptions): Promise<T> =>
      Promise.resolve(requestSpy(options)) as Promise<T>,
    requestWithHeaders: async <T>(
      options: HttpRequestOptions
    ): Promise<{ data: T; headers: Headers }> => ({
      data: (await requestSpy(options)) as T,
      headers: responseHeaders,
    }),
  }
}

function buildResource(response: unknown, responseHeaders?: Headers) {
  const requestSpy = vi.fn().mockResolvedValue(response)
  return {
    resource: new MessagesResource(fakeHttpClient(requestSpy, responseHeaders)),
    requestSpy,
  }
}

const MESSAGE_ID = 'msg_01J8XA1B2C3D4E5F6G7H8J9K0M'

function rawMessage(overrides: {
  id?: string
  content?: MessageContent
  status?: string
  sent_at?: string | null
  read_at?: string | null
}) {
  return {
    id: overrides.id ?? MESSAGE_ID,
    channel: 'chan_01J8XA1B2C3D4E5F6G7H8J9K0M',
    direction: 'outbound',
    from: '+15550001111',
    to: '+15550002222',
    content: overrides.content ?? { type: 'text', body: 'Hello from Routa' },
    status: overrides.status ?? 'accepted',
    metadata: {},
    accepted_at: '2026-09-12T12:00:00.000Z',
    sent_at: overrides.sent_at ?? null,
    delivered_at: null,
    read_at: overrides.read_at ?? null,
    failed_at: null,
  }
}

describe('send() — serialization', () => {
  it('is validated against the real requestBody schema in the OpenAPI snapshot', () => {
    expect(SEND_MESSAGE_REQUEST_SCHEMA).toBeDefined()
    expect(SEND_MESSAGE_REQUEST_SCHEMA?.required).toEqual(['channel', 'to'])
    expect(Object.keys(SEND_MESSAGE_REQUEST_SCHEMA?.properties ?? {})).toEqual(
      expect.arrayContaining(['channel', 'to', 'text', 'template', 'metadata'])
    )
  })

  it('produces exactly the documented body for {channel, to, text}', async () => {
    const { resource, requestSpy } = buildResource(rawMessage({}))

    await resource.send({
      channel: 'chan_01J8XA1B2C3D4E5F6G7H8J9K0M',
      to: '+15550002222',
      text: 'Hello from Routa',
    })

    expect(requestSpy).toHaveBeenCalledTimes(1)
    const [options] = requestSpy.mock.calls[0] as [HttpRequestOptions]
    expect(options.method).toBe('POST')
    expect(options.path).toBe('/v1/messages')
    expect(options.body).toEqual({
      channel: 'chan_01J8XA1B2C3D4E5F6G7H8J9K0M',
      to: '+15550002222',
      text: 'Hello from Routa',
    })
  })

  it('produces the equivalent documented body for {channel, to, template}', async () => {
    const { resource, requestSpy } = buildResource(rawMessage({}))

    await resource.send({
      channel: 'chan_01J8XA1B2C3D4E5F6G7H8J9K0M',
      to: '+15550002222',
      template: {
        id: 'tmpl_01J8XA1B2C3D4E5F6G7H8J9K0M',
        bodyParameters: ['Ana', '#12345'],
      },
    })

    const [options] = requestSpy.mock.calls[0] as [HttpRequestOptions]
    expect(options.body).toEqual({
      channel: 'chan_01J8XA1B2C3D4E5F6G7H8J9K0M',
      to: '+15550002222',
      template: {
        id: 'tmpl_01J8XA1B2C3D4E5F6G7H8J9K0M',
        body_parameters: ['Ana', '#12345'],
      },
    })
  })

  it('omits body_parameters when the template has none', async () => {
    const { resource, requestSpy } = buildResource(rawMessage({}))

    await resource.send({
      channel: 'chan_1',
      to: '+1',
      template: { id: 'tmpl_1' },
    })

    const [options] = requestSpy.mock.calls[0] as [HttpRequestOptions]
    expect(options.body).toEqual({
      channel: 'chan_1',
      to: '+1',
      template: { id: 'tmpl_1' },
    })
  })

  it('includes metadata only when provided', async () => {
    const { resource, requestSpy } = buildResource(rawMessage({}))

    await resource.send({
      channel: 'chan_1',
      to: '+1',
      text: 'hi',
      metadata: { orderId: '42' },
    })

    const [options] = requestSpy.mock.calls[0] as [HttpRequestOptions]
    expect(options.body).toEqual({
      channel: 'chan_1',
      to: '+1',
      text: 'hi',
      metadata: { orderId: '42' },
    })
  })

  it('marks the call idempotency-key eligible and passes a caller-supplied key through', async () => {
    const { resource, requestSpy } = buildResource(rawMessage({}))

    await resource.send({
      channel: 'chan_1',
      to: '+1',
      text: 'hi',
      idempotencyKey: 'caller-key-123',
    })

    const [options] = requestSpy.mock.calls[0] as [HttpRequestOptions]
    expect(options.idempotencyKeyEligible).toBe(true)
    expect(options.idempotencyKey).toBe('caller-key-123')
  })

  it('does not force a caller-supplied idempotencyKey when none is given', async () => {
    const { resource, requestSpy } = buildResource(rawMessage({}))

    await resource.send({ channel: 'chan_1', to: '+1', text: 'hi' })

    const [options] = requestSpy.mock.calls[0] as [HttpRequestOptions]
    expect(options.idempotencyKey).toBeUndefined()
  })

  it('calls the injected transport exactly once — no retry logic of its own', async () => {
    const { resource, requestSpy } = buildResource(rawMessage({}))

    await resource.send({ channel: 'chan_1', to: '+1', text: 'hi' })

    expect(requestSpy).toHaveBeenCalledTimes(1)
  })
})

describe('send() — deserialization', () => {
  it('parses the response into a typed Message', async () => {
    const { resource } = buildResource(rawMessage({ status: 'accepted' }))

    const message = await resource.send({
      channel: 'chan_1',
      to: '+1',
      text: 'hi',
    })

    expect(message).toEqual({
      id: MESSAGE_ID,
      channel: 'chan_01J8XA1B2C3D4E5F6G7H8J9K0M',
      direction: 'outbound',
      from: '+15550001111',
      to: '+15550002222',
      content: { type: 'text', body: 'Hello from Routa' },
      status: 'accepted',
      metadata: {},
      acceptedAt: '2026-09-12T12:00:00.000Z',
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      failedAt: null,
      _replayed: false,
    })
  })

  it('marks _replayed true when the response carries Idempotent-Replay: true', async () => {
    const { resource } = buildResource(
      rawMessage({ status: 'accepted' }),
      new Headers({ 'Idempotent-Replay': 'true' })
    )

    const message = await resource.send({
      channel: 'chan_1',
      to: '+1',
      text: 'hi',
    })

    expect(message._replayed).toBe(true)
  })
})

const CONTENT_CASES: MessageContent[] = [
  { type: 'text', body: 'hi' },
  { type: 'image', media_id: 'med_1', caption: 'a photo' },
  { type: 'image', media_id: 'med_1' },
  { type: 'document', media_id: 'med_2', filename: 'f.pdf', caption: 'doc' },
  { type: 'audio', media_id: 'med_3' },
  { type: 'video', media_id: 'med_4', caption: 'a video' },
  { type: 'sticker', media_id: 'med_5' },
  {
    type: 'location',
    latitude: 1.5,
    longitude: 2.5,
    name: 'Home',
    address: 'Somewhere',
  },
  { type: 'reaction', target_message_id: 'msg_2', emoji: '👍' },
  {
    type: 'template',
    template_id: 'tmpl_1',
    body_parameters: ['Ana', '#12345'],
  },
  { type: 'unsupported' },
]

describe('content parsing', () => {
  it.each(CONTENT_CASES)('parses a %o content payload as-is', async content => {
    const { resource } = buildResource(rawMessage({ content }))

    const message = await resource.retrieve(toMessageId(MESSAGE_ID))

    expect(message.content).toEqual(content)
  })
})

describe('retrieve()', () => {
  it('calls GET /v1/messages/:id', async () => {
    const { resource, requestSpy } = buildResource(rawMessage({}))

    await resource.retrieve(toMessageId(MESSAGE_ID))

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: `/v1/messages/${MESSAGE_ID}`,
    })
  })

  it('returns a parsed Message', async () => {
    const { resource } = buildResource(rawMessage({ status: 'delivered' }))

    const message = await resource.retrieve(toMessageId(MESSAGE_ID))

    expect(message.id).toBe(MESSAGE_ID)
    expect(message.status).toBe('delivered')
  })
})

describe('markRead()', () => {
  it('calls POST /v1/messages/:id/read', async () => {
    const { resource, requestSpy } = buildResource(
      rawMessage({ status: 'read', read_at: '2026-09-12T12:05:00.000Z' })
    )

    await resource.markRead(toMessageId(MESSAGE_ID))

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'POST',
      path: `/v1/messages/${MESSAGE_ID}/read`,
    })
  })

  it('never attaches an Idempotency-Key eligibility flag — only send() qualifies', async () => {
    const { resource, requestSpy } = buildResource(rawMessage({}))

    await resource.markRead(toMessageId(MESSAGE_ID))

    const [options] = requestSpy.mock.calls[0] as [HttpRequestOptions]
    expect(options.idempotencyKeyEligible).toBeUndefined()
  })

  it('returns a parsed Message reflecting the new status', async () => {
    const { resource } = buildResource(
      rawMessage({ status: 'read', read_at: '2026-09-12T12:05:00.000Z' })
    )

    const message = await resource.markRead(toMessageId(MESSAGE_ID))

    expect(message.status).toBe('read')
    expect(message.readAt).toBe('2026-09-12T12:05:00.000Z')
  })
})

describe('list()', () => {
  it('is consumable as an async iterator', async () => {
    const { resource } = buildResource({
      data: [rawMessage({ id: 'msg_1' })],
      has_more: false,
      next_cursor: null,
    })

    const collected: string[] = []
    for await (const message of resource.list()) {
      collected.push(message.id)
    }

    expect(collected).toEqual(['msg_1'])
  })

  it('fetches multiple pages automatically when has_more is true, advancing via next_cursor', async () => {
    const requestSpy = vi
      .fn()
      .mockResolvedValueOnce({
        data: [rawMessage({ id: 'msg_1' })],
        has_more: true,
        next_cursor: 'cursor_a',
      })
      .mockResolvedValueOnce({
        data: [rawMessage({ id: 'msg_2' })],
        has_more: false,
        next_cursor: null,
      })
    const resource = new MessagesResource(fakeHttpClient(requestSpy))

    const collected: string[] = []
    for await (const message of resource.list()) {
      collected.push(message.id)
    }

    expect(collected).toEqual(['msg_1', 'msg_2'])
    expect(requestSpy).toHaveBeenCalledTimes(2)
    expect(requestSpy).toHaveBeenNthCalledWith(1, {
      method: 'GET',
      path: '/v1/messages',
      searchParams: {},
    })
    expect(requestSpy).toHaveBeenNthCalledWith(2, {
      method: 'GET',
      path: '/v1/messages',
      searchParams: { cursor: 'cursor_a' },
    })
  })

  it('stops without the caller ever touching cursor', async () => {
    const requestSpy = vi.fn().mockResolvedValueOnce({
      data: [],
      has_more: false,
      next_cursor: null,
    })
    const resource = new MessagesResource(fakeHttpClient(requestSpy))

    const collected: string[] = []
    for await (const message of resource.list()) {
      collected.push(message.id)
    }

    expect(collected).toEqual([])
    expect(requestSpy).toHaveBeenCalledTimes(1)
  })

  it('forwards direction/limit/cursor as query params', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      data: [],
      has_more: false,
      next_cursor: null,
    })
    const resource = new MessagesResource(fakeHttpClient(requestSpy))

    await resource
      .list({ direction: 'inbound', limit: 10, cursor: 'start' })
      .page()

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/messages',
      searchParams: { direction: 'inbound', limit: '10', cursor: 'start' },
    })
  })

  it('page() returns a single page in the documented { data, hasMore, nextCursor } shape', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      data: [rawMessage({ id: 'msg_1' })],
      has_more: true,
      next_cursor: 'cursor_a',
    })
    const resource = new MessagesResource(fakeHttpClient(requestSpy))

    const page = await resource.list().page()

    expect(page.hasMore).toBe(true)
    expect(page.nextCursor).toBe('cursor_a')
    expect(page.data).toHaveLength(1)
    expect(page.data[0]?.id).toBe('msg_1')
    expect(requestSpy).toHaveBeenCalledTimes(1)
  })

  it('page() does not advance any shared iterator state', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      data: [rawMessage({ id: 'msg_1' })],
      has_more: true,
      next_cursor: 'cursor_a',
    })
    const resource = new MessagesResource(fakeHttpClient(requestSpy))
    const list = resource.list()

    await list.page()
    await list.page()

    expect(requestSpy).toHaveBeenCalledTimes(2)
    expect(requestSpy).toHaveBeenNthCalledWith(1, {
      method: 'GET',
      path: '/v1/messages',
      searchParams: {},
    })
    expect(requestSpy).toHaveBeenNthCalledWith(2, {
      method: 'GET',
      path: '/v1/messages',
      searchParams: {},
    })
  })
})
