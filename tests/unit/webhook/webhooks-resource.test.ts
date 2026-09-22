import { describe, expect, it, vi } from 'vitest'
import type {
  HttpClient,
  HttpRequestOptions,
} from '../../../src/http/http-client'
import { toWebhookId } from '../../../src/webhook/webhook-id'
import type { RawWebhook } from '../../../src/webhook/webhook-mapper'
import { WebhooksResource } from '../../../src/webhook/webhooks-resource'

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

function rawWebhook(overrides: Partial<RawWebhook>): RawWebhook {
  return {
    id: WEBHOOK_ID,
    url: 'https://example.com/webhooks/routa',
    subscribed_types: ['message.*'],
    api_version: '2026-01-01',
    status: 'enabled',
    consecutive_failures: 0,
    last_success_at: null,
    last_failure_at: null,
    created_at: '2026-09-12T12:00:00.000Z',
    ...overrides,
  }
}

describe('create() — serialization', () => {
  it('produces exactly the documented body', async () => {
    const requestSpy = vi
      .fn()
      .mockResolvedValue({ ...rawWebhook({}), secret: 'whsec_abc' })
    const resource = new WebhooksResource(fakeHttpClient(requestSpy))

    await resource.create({
      url: 'https://example.com/webhooks/routa',
      subscribedTypes: ['message.*', 'template.approved'],
    })

    const [options] = requestSpy.mock.calls[0] as [HttpRequestOptions]
    expect(options.method).toBe('POST')
    expect(options.path).toBe('/v1/webhook_endpoints')
    expect(options.body).toEqual({
      url: 'https://example.com/webhooks/routa',
      subscribed_types: ['message.*', 'template.approved'],
    })
  })

  it('never marks the call idempotency-key eligible', async () => {
    const requestSpy = vi
      .fn()
      .mockResolvedValue({ ...rawWebhook({}), secret: 'whsec_abc' })
    const resource = new WebhooksResource(fakeHttpClient(requestSpy))

    await resource.create({
      url: 'https://example.com/hook',
      subscribedTypes: ['message.*'],
    })

    const [options] = requestSpy.mock.calls[0] as [HttpRequestOptions]
    expect(options.idempotencyKeyEligible).toBeUndefined()
  })

  it('returns a parsed Webhook including the one-time secret', async () => {
    const requestSpy = vi
      .fn()
      .mockResolvedValue({ ...rawWebhook({}), secret: 'whsec_abc' })
    const resource = new WebhooksResource(fakeHttpClient(requestSpy))

    const webhook = await resource.create({
      url: 'https://example.com/webhooks/routa',
      subscribedTypes: ['message.*'],
    })

    expect(webhook).toEqual({
      id: WEBHOOK_ID,
      url: 'https://example.com/webhooks/routa',
      subscribedTypes: ['message.*'],
      apiVersion: '2026-01-01',
      status: 'enabled',
      consecutiveFailures: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      createdAt: '2026-09-12T12:00:00.000Z',
      secret: 'whsec_abc',
    })
  })
})

describe('list()', () => {
  it('calls GET /v1/webhook_endpoints with no params and returns a Page', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      data: [rawWebhook({})],
      has_more: false,
      next_cursor: null,
    })
    const resource = new WebhooksResource(fakeHttpClient(requestSpy))

    const page = await resource.list()

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/webhook_endpoints',
    })
    expect(page.hasMore).toBe(false)
    expect(page.data).toHaveLength(1)
    expect(page.data[0]?.id).toBe(WEBHOOK_ID)
  })

  it('list items never include a secret', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      data: [rawWebhook({})],
      has_more: false,
      next_cursor: null,
    })
    const resource = new WebhooksResource(fakeHttpClient(requestSpy))

    const page = await resource.list()

    expect(page.data[0]).not.toHaveProperty('secret')
  })
})

describe('retrieve()', () => {
  it('calls GET /v1/webhook_endpoints/:id', async () => {
    const requestSpy = vi.fn().mockResolvedValue(rawWebhook({}))
    const resource = new WebhooksResource(fakeHttpClient(requestSpy))

    await resource.retrieve(toWebhookId(WEBHOOK_ID))

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: `/v1/webhook_endpoints/${WEBHOOK_ID}`,
    })
  })
})

describe('update() — serialization', () => {
  it('calls PATCH /v1/webhook_endpoints/:id with the documented body', async () => {
    const requestSpy = vi
      .fn()
      .mockResolvedValue(rawWebhook({ subscribed_types: ['template.*'] }))
    const resource = new WebhooksResource(fakeHttpClient(requestSpy))

    await resource.update(toWebhookId(WEBHOOK_ID), {
      subscribedTypes: ['template.*'],
    })

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'PATCH',
      path: `/v1/webhook_endpoints/${WEBHOOK_ID}`,
      body: { subscribed_types: ['template.*'] },
    })
  })
})

describe('enable()', () => {
  it('calls POST /v1/webhook_endpoints/:id/enable and returns replayedCount', async () => {
    const requestSpy = vi
      .fn()
      .mockResolvedValue({ ...rawWebhook({}), replayed_count: 3 })
    const resource = new WebhooksResource(fakeHttpClient(requestSpy))

    const result = await resource.enable(toWebhookId(WEBHOOK_ID))

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'POST',
      path: `/v1/webhook_endpoints/${WEBHOOK_ID}/enable`,
    })
    expect(result.replayedCount).toBe(3)
    expect(result.status).toBe('enabled')
  })
})

describe('disable()', () => {
  it('calls POST /v1/webhook_endpoints/:id/disable', async () => {
    const requestSpy = vi
      .fn()
      .mockResolvedValue(rawWebhook({ status: 'disabled_by_user' }))
    const resource = new WebhooksResource(fakeHttpClient(requestSpy))

    const webhook = await resource.disable(toWebhookId(WEBHOOK_ID))

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'POST',
      path: `/v1/webhook_endpoints/${WEBHOOK_ID}/disable`,
    })
    expect(webhook.status).toBe('disabled_by_user')
  })
})

describe('rotateSecret()', () => {
  it('calls POST /v1/webhook_endpoints/:id/rotate_secret and returns the new secret', async () => {
    const requestSpy = vi
      .fn()
      .mockResolvedValue({ ...rawWebhook({}), secret: 'whsec_new' })
    const resource = new WebhooksResource(fakeHttpClient(requestSpy))

    const webhook = await resource.rotateSecret(toWebhookId(WEBHOOK_ID))

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'POST',
      path: `/v1/webhook_endpoints/${WEBHOOK_ID}/rotate_secret`,
    })
    expect(webhook.secret).toBe('whsec_new')
  })
})

describe('deliveries sub-resource', () => {
  it('is exposed as webhooks.deliveries', () => {
    const resource = new WebhooksResource(fakeHttpClient(() => undefined))
    expect(resource.deliveries).toBeDefined()
  })
})
