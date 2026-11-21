import { describe, expect, it } from 'vitest'
import { partnerWith } from './support'

const RAW_WEBHOOK = {
  id: 'whe_01J8XA1B2C3D4E5F6G7H8J9K0M',
  url: 'https://crm.example.com/routa',
  subscribed_types: ['message.*'],
  api_version: 'v1',
  status: 'enabled',
  consecutive_failures: 0,
  last_success_at: null,
  last_failure_at: null,
  created_at: '2026-11-20T12:00:00.000Z',
} as const

describe('webhook.set()', () => {
  it('PUTs the documented body', async () => {
    const { partner, requests } = partnerWith([
      { status: 201, body: { ...RAW_WEBHOOK, secret: 'whsec_abc' } },
    ])

    await partner.webhook.set({
      url: 'https://crm.example.com/routa',
      subscribedTypes: ['message.*', 'channel.status_changed'],
    })

    expect(requests[0]?.method).toBe('PUT')
    expect(requests[0]?.url.pathname).toBe('/v1/partner/webhook')
    expect(JSON.parse(requests[0]?.body ?? '')).toEqual({
      url: 'https://crm.example.com/routa',
      subscribed_types: ['message.*', 'channel.status_changed'],
    })
    expect(requests[0]?.headers.has('Idempotency-Key')).toBe(false)
  })

  it('returns the secret when it created the webhook (201)', async () => {
    const { partner } = partnerWith([
      { status: 201, body: { ...RAW_WEBHOOK, secret: 'whsec_abc' } },
    ])

    const result = await partner.webhook.set({
      url: 'https://crm.example.com/routa',
      subscribedTypes: ['message.*'],
    })

    expect(result.secret).toBe('whsec_abc')
    expect(result.webhook.id).toBe('whe_01J8XA1B2C3D4E5F6G7H8J9K0M')
    expect('secret' in result.webhook).toBe(false)
  })

  it('has no secret at all when it replaced the webhook (200)', async () => {
    const { partner } = partnerWith([{ status: 200, body: RAW_WEBHOOK }])

    const result = await partner.webhook.set({
      url: 'https://crm.example.com/routa',
      subscribedTypes: ['message.*'],
    })

    expect('secret' in result).toBe(false)
    expect(result.webhook.subscribedTypes).toEqual(['message.*'])
  })
})

describe('webhook.retrieve()', () => {
  it('GETs the webhook and parses it without a secret', async () => {
    const { partner, requests } = partnerWith([
      { status: 200, body: RAW_WEBHOOK },
    ])

    const webhook = await partner.webhook.retrieve()

    expect(requests[0]?.method).toBe('GET')
    expect(requests[0]?.url.pathname).toBe('/v1/partner/webhook')
    expect(webhook).toMatchObject({
      url: 'https://crm.example.com/routa',
      status: 'enabled',
      apiVersion: 'v1',
      consecutiveFailures: 0,
    })
  })
})

describe('webhook.rotateSecret()', () => {
  it('POSTs to /rotate_secret and returns the new secret', async () => {
    const { partner, requests } = partnerWith([
      { status: 201, body: { ...RAW_WEBHOOK, secret: 'whsec_new' } },
    ])

    const webhook = await partner.webhook.rotateSecret()

    expect(requests[0]?.method).toBe('POST')
    expect(requests[0]?.url.pathname).toBe('/v1/partner/webhook/rotate_secret')
    expect(webhook.secret).toBe('whsec_new')
  })
})
