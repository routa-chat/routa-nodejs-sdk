import { describe, expect, it } from 'vitest'
import { toApiKeyId, toPartnerProjectId } from '../../../src/partner'
import { KEY_ID, PROJECT_ID, partnerWith } from './support'

const projectId = toPartnerProjectId(PROJECT_ID)
const keyId = toApiKeyId(KEY_ID)

const RAW_KEY = {
  id: KEY_ID,
  project_id: PROJECT_ID,
  name: 'Loja do Zé',
  key_prefix: 'rt_live_abc',
  last_four: 'wxyz',
  scopes: ['messages:write', 'messages:read'],
  expires_at: null,
  ip_allowlist: [],
  created_at: '2026-11-20T12:00:00.000Z',
  revoked_at: null,
  last_used_at: null,
} as const

describe('projects.apiKeys.create()', () => {
  it('sends the documented body and returns the secret', async () => {
    const { partner, requests } = partnerWith([
      {
        status: 201,
        body: { ...RAW_KEY, secret: 'rt_live_abcdefghijklmnopqrstuv' },
      },
    ])

    const key = await partner.projects.apiKeys.create(projectId, {
      name: 'Loja do Zé',
      scopes: ['messages:write', 'messages:read'],
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      ipAllowlist: ['203.0.113.7'],
    })

    expect(requests[0]?.method).toBe('POST')
    expect(requests[0]?.url.pathname).toBe(
      `/v1/partner/projects/${PROJECT_ID}/api_keys`
    )
    expect(JSON.parse(requests[0]?.body ?? '')).toEqual({
      name: 'Loja do Zé',
      scopes: ['messages:write', 'messages:read'],
      expires_at: '2027-01-01T00:00:00.000Z',
      ip_allowlist: ['203.0.113.7'],
    })
    expect(requests[0]?.headers.has('Idempotency-Key')).toBe(false)
    expect(key.secret).toBe('rt_live_abcdefghijklmnopqrstuv')
    expect(key).toMatchObject({
      id: KEY_ID,
      projectId: PROJECT_ID,
      keyPrefix: 'rt_live_abc',
      lastFour: 'wxyz',
      scopes: ['messages:write', 'messages:read'],
      expiresAt: null,
      ipAllowlist: [],
      revokedAt: null,
      lastUsedAt: null,
    })
  })

  it('leaves out every optional field that was not given, and passes an ISO string through', async () => {
    const { partner, requests } = partnerWith([
      { status: 201, body: { ...RAW_KEY, secret: 's' } },
      { status: 201, body: { ...RAW_KEY, secret: 's' } },
    ])

    await partner.projects.apiKeys.create(projectId, {
      scopes: ['messages:read'],
    })
    await partner.projects.apiKeys.create(projectId, {
      scopes: ['messages:read'],
      expiresAt: '2027-01-01T00:00:00Z',
    })

    expect(JSON.parse(requests[0]?.body ?? '')).toEqual({
      scopes: ['messages:read'],
    })
    expect(JSON.parse(requests[1]?.body ?? '').expires_at).toBe(
      '2027-01-01T00:00:00Z'
    )
  })
})

describe('projects.apiKeys.rotate()', () => {
  it('POSTs to /rotate with no body and returns the new secret', async () => {
    const { partner, requests } = partnerWith([
      { status: 201, body: { ...RAW_KEY, secret: 'rt_live_new' } },
    ])

    const key = await partner.projects.apiKeys.rotate(projectId, keyId)

    expect(requests[0]?.method).toBe('POST')
    expect(requests[0]?.url.pathname).toBe(
      `/v1/partner/projects/${PROJECT_ID}/api_keys/${KEY_ID}/rotate`
    )
    expect(requests[0]?.body).toBeUndefined()
    expect(key.secret).toBe('rt_live_new')
  })
})

describe('projects.apiKeys.revoke()', () => {
  it('POSTs to /revoke and returns the key without a secret', async () => {
    const { partner, requests } = partnerWith([
      {
        status: 200,
        body: { ...RAW_KEY, revoked_at: '2026-11-21T00:00:00.000Z' },
      },
    ])

    const key = await partner.projects.apiKeys.revoke(projectId, keyId)

    expect(requests[0]?.url.pathname).toBe(
      `/v1/partner/projects/${PROJECT_ID}/api_keys/${KEY_ID}/revoke`
    )
    expect(key.revokedAt).toBe('2026-11-21T00:00:00.000Z')
    expect('secret' in key).toBe(false)
  })
})
