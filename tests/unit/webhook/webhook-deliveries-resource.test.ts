import { describe, expect, it, vi } from 'vitest'
import type {
  HttpClient,
  HttpRequestOptions,
} from '../../../src/http/http-client'
import { WebhookDeliveriesResource } from '../../../src/webhook/webhook-deliveries-resource'
import { toWebhookDeliveryId } from '../../../src/webhook/webhook-delivery-id'
import type { RawWebhookDelivery } from '../../../src/webhook/webhook-delivery-mapper'
import { toWebhookId } from '../../../src/webhook/webhook-id'

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

const WEBHOOK_ID = 'whe_01J8XA1B2C3D4E5F6G7H8J9K0M'
const DELIVERY_ID = 'whd_01J8XA1B2C3D4E5F6G7H8J9K0M'

function rawDelivery(
  overrides: Partial<RawWebhookDelivery>
): RawWebhookDelivery {
  return {
    id: DELIVERY_ID,
    event_id: 'evt_01J8XA1B2C3D4E5F6G7H8J9K0M',
    event_type: 'message.delivered',
    state: 'succeeded',
    attempt_count: 1,
    next_attempt_at: '2026-09-12T12:00:00.000Z',
    last_response_status: 200,
    last_error_code: null,
    succeeded_at: '2026-09-12T12:00:01.000Z',
    exhausted_at: null,
    created_at: '2026-09-12T11:59:59.000Z',
    ...overrides,
  }
}

describe('list()', () => {
  it('calls GET /v1/webhook_endpoints/:id/deliveries', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      data: [rawDelivery({})],
      has_more: false,
      next_cursor: null,
    })
    const resource = new WebhookDeliveriesResource(fakeHttpClient(requestSpy))

    const collected: string[] = []
    for await (const delivery of resource.list(toWebhookId(WEBHOOK_ID))) {
      collected.push(delivery.id)
    }

    expect(collected).toEqual([DELIVERY_ID])
    expect(requestSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: `/v1/webhook_endpoints/${WEBHOOK_ID}/deliveries`,
      searchParams: {},
    })
  })

  it('forwards state/limit/cursor as query params', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      data: [],
      has_more: false,
      next_cursor: null,
    })
    const resource = new WebhookDeliveriesResource(fakeHttpClient(requestSpy))

    await resource
      .list(toWebhookId(WEBHOOK_ID), {
        state: 'exhausted',
        limit: 25,
        cursor: 'start',
      })
      .page()

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: `/v1/webhook_endpoints/${WEBHOOK_ID}/deliveries`,
      searchParams: { state: 'exhausted', limit: '25', cursor: 'start' },
    })
  })

  it('returns a parsed WebhookDelivery reflecting the wire fields', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      data: [rawDelivery({ state: 'exhausted', last_error_code: 'timeout' })],
      has_more: false,
      next_cursor: null,
    })
    const resource = new WebhookDeliveriesResource(fakeHttpClient(requestSpy))

    const page = await resource.list(toWebhookId(WEBHOOK_ID)).page()

    expect(page.data[0]).toEqual({
      id: DELIVERY_ID,
      eventId: 'evt_01J8XA1B2C3D4E5F6G7H8J9K0M',
      eventType: 'message.delivered',
      state: 'exhausted',
      attemptCount: 1,
      nextAttemptAt: '2026-09-12T12:00:00.000Z',
      lastResponseStatus: 200,
      lastErrorCode: 'timeout',
      succeededAt: '2026-09-12T12:00:01.000Z',
      exhaustedAt: null,
      createdAt: '2026-09-12T11:59:59.000Z',
    })
  })
})

describe('replay()', () => {
  it('bulk-replays every exhausted delivery when no deliveryId is given', async () => {
    const requestSpy = vi.fn().mockResolvedValue({ replayed_count: 7 })
    const resource = new WebhookDeliveriesResource(fakeHttpClient(requestSpy))

    const result = await resource.replay(toWebhookId(WEBHOOK_ID))

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'POST',
      path: `/v1/webhook_endpoints/${WEBHOOK_ID}/deliveries/replay`,
    })
    expect(result).toEqual({ replayedCount: 7 })
  })

  it('replays a single delivery when deliveryId is given', async () => {
    const requestSpy = vi.fn().mockResolvedValue({ replayed_count: 1 })
    const resource = new WebhookDeliveriesResource(fakeHttpClient(requestSpy))

    const result = await resource.replay(
      toWebhookId(WEBHOOK_ID),
      toWebhookDeliveryId(DELIVERY_ID)
    )

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'POST',
      path: `/v1/webhook_endpoints/${WEBHOOK_ID}/deliveries/${DELIVERY_ID}/replay`,
    })
    expect(result).toEqual({ replayedCount: 1 })
  })
})
