import { describe, expect, it, vi } from 'vitest'
import type { EventType } from '../../../src/event/event'
import { parseEvent, type RawEvent } from '../../../src/event/event-mapper'
import { EventsResource } from '../../../src/event/events-resource'
import type {
  HttpClient,
  HttpRequestOptions,
} from '../../../src/http/http-client'

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

const EVENT_ID = 'evt_01J8XA1B2C3D4E5F6G7H8J9K0M'

function rawEvent(overrides: {
  id?: string
  type?: EventType
  data?: unknown
}): RawEvent {
  return {
    id: overrides.id ?? EVENT_ID,
    type: overrides.type ?? 'message.accepted',
    api_version: '2026-01-01',
    schema_version: 1,
    project_id: 'proj_01J8XA1B2C3D4E5F6G7H8J9K0M',
    sequence: 42,
    occurred_at: '2026-09-12T12:00:00.000Z',
    recorded_at: '2026-09-12T12:00:01.000Z',
    data: overrides.data ?? { messageId: 'msg_1' },
  }
}

const KNOWN_EVENT_TYPES: EventType[] = [
  'message.accepted',
  'message.sent',
  'message.delivered',
  'message.read',
  'message.failed',
  'message.received',
  'channel.status_changed',
  'template.submitted',
  'template.pending',
  'template.approved',
  'template.rejected',
  'template.paused',
  'template.disabled',
]

describe('parseEvent()', () => {
  it('maps every field from the wire shape into camelCase', () => {
    const event = parseEvent(rawEvent({}))

    expect(event).toEqual({
      id: EVENT_ID,
      type: 'message.accepted',
      apiVersion: '2026-01-01',
      schemaVersion: 1,
      projectId: 'proj_01J8XA1B2C3D4E5F6G7H8J9K0M',
      sequence: 42,
      occurredAt: '2026-09-12T12:00:00.000Z',
      recordedAt: '2026-09-12T12:00:01.000Z',
      data: { messageId: 'msg_1' },
    })
  })

  it.each(KNOWN_EVENT_TYPES)('accepts the real event type %s', type => {
    expect(parseEvent(rawEvent({ type })).type).toBe(type)
  })

  it('deserializes an event type outside the known set to the generic fallback, never throwing', () => {
    const raw: RawEvent = { ...rawEvent({}), type: 'something.unknown' }

    expect(parseEvent(raw)).toEqual({
      type: 'something.unknown',
      data: { messageId: 'msg_1' },
    })
  })

  it('passes data through unparsed', () => {
    const data = { arbitrary: 'shape', nested: { ok: true } }
    expect(parseEvent(rawEvent({ data })).data).toEqual(data)
  })
})

describe('EventsResource.list()', () => {
  it('is consumable as an async iterator', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      data: [rawEvent({ id: 'evt_1' })],
      has_more: false,
      next_cursor: null,
    })
    const resource = new EventsResource(fakeHttpClient(requestSpy))

    const collected: string[] = []
    for await (const event of resource.list()) {
      if ('id' in event) {
        collected.push(event.id)
      }
    }

    expect(collected).toEqual(['evt_1'])
    expect(requestSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/events',
      searchParams: {},
    })
  })

  it('forwards type/limit as query params, and paginates via after=next_cursor', async () => {
    const requestSpy = vi
      .fn()
      .mockResolvedValueOnce({
        data: [rawEvent({ id: 'evt_1' })],
        has_more: true,
        next_cursor: 'evt_1',
      })
      .mockResolvedValueOnce({
        data: [rawEvent({ id: 'evt_2' })],
        has_more: false,
        next_cursor: null,
      })
    const resource = new EventsResource(fakeHttpClient(requestSpy))

    const collected: string[] = []
    for await (const event of resource.list({
      type: 'message.delivered',
      limit: 10,
    })) {
      if ('id' in event) {
        collected.push(event.id)
      }
    }

    expect(collected).toEqual(['evt_1', 'evt_2'])
    expect(requestSpy).toHaveBeenNthCalledWith(1, {
      method: 'GET',
      path: '/v1/events',
      searchParams: { type: 'message.delivered', limit: '10' },
    })
    expect(requestSpy).toHaveBeenNthCalledWith(2, {
      method: 'GET',
      path: '/v1/events',
      searchParams: { type: 'message.delivered', limit: '10', after: 'evt_1' },
    })
  })

  it('page() returns a single page in the documented { data, hasMore, nextCursor } shape', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      data: [rawEvent({ id: 'evt_1' })],
      has_more: true,
      next_cursor: 'evt_1',
    })
    const resource = new EventsResource(fakeHttpClient(requestSpy))

    const page = await resource.list().page()

    expect(page.hasMore).toBe(true)
    expect(page.nextCursor).toBe('evt_1')
    expect(page.data).toHaveLength(1)
    const [first] = page.data
    expect(first && 'id' in first ? first.id : undefined).toBe('evt_1')
    expect(requestSpy).toHaveBeenCalledTimes(1)
  })
})
