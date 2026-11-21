import { describe, expect, it } from 'vitest'
import { toChannelId } from '../../../src/domain/channel-id'
import { RoutaConflictError } from '../../../src/domain/errors/routa-conflict-error'
import { toPartnerProjectId } from '../../../src/partner'
import { CHANNEL_ID, errorEnvelope, PROJECT_ID, partnerWith } from './support'

const RAW_CHANNEL = {
  id: CHANNEL_ID,
  project_id: PROJECT_ID,
  external_ref: 'lead_123',
  address: '+5511999990000',
  status: 'disabled',
  status_reason_code: 'disconnected_by_customer',
  connection_mode: 'coexistence',
  disconnection_reason: 'change_number',
  created_at: '2026-11-20T12:00:00.000Z',
} as const

describe('channels.list()', () => {
  it('parses every field of the channel', async () => {
    const { partner } = partnerWith([
      {
        status: 200,
        body: { data: [RAW_CHANNEL], has_more: false, next_cursor: null },
      },
    ])

    const page = await partner.channels.list().page()

    expect(page.data).toEqual([
      {
        id: CHANNEL_ID,
        projectId: PROJECT_ID,
        externalRef: 'lead_123',
        address: '+5511999990000',
        status: 'disabled',
        statusReasonCode: 'disconnected_by_customer',
        connectionMode: 'coexistence',
        disconnectionReason: 'change_number',
        createdAt: '2026-11-20T12:00:00.000Z',
      },
    ])
  })

  it('keeps null reasons as null', async () => {
    const { partner } = partnerWith([
      {
        status: 200,
        body: {
          data: [
            {
              ...RAW_CHANNEL,
              status: 'active',
              status_reason_code: null,
              disconnection_reason: null,
              connection_mode: 'cloud_api',
            },
          ],
          has_more: false,
          next_cursor: null,
        },
      },
    ])

    const [channel] = (await partner.channels.list().page()).data

    expect(channel?.statusReasonCode).toBeNull()
    expect(channel?.disconnectionReason).toBeNull()
  })

  it('serializes every filter to its documented query param', async () => {
    const { partner, requests } = partnerWith([
      { status: 200, body: { data: [], has_more: false, next_cursor: null } },
    ])

    await partner.channels
      .list({
        status: 'disabled',
        projectId: toPartnerProjectId(PROJECT_ID),
        externalRef: 'lead_123',
        limit: 10,
        cursor: 'c1',
      })
      .page()

    expect(requests[0]?.url.pathname).toBe('/v1/partner/channels')
    expect(Object.fromEntries(requests[0]?.url.searchParams ?? [])).toEqual({
      status: 'disabled',
      project_id: PROJECT_ID,
      external_ref: 'lead_123',
      limit: '10',
      cursor: 'c1',
    })
  })

  it('iterates across pages', async () => {
    const { partner } = partnerWith([
      {
        status: 200,
        body: { data: [RAW_CHANNEL], has_more: true, next_cursor: 'c2' },
      },
      {
        status: 200,
        body: { data: [RAW_CHANNEL], has_more: false, next_cursor: null },
      },
    ])

    let count = 0
    for await (const _ of partner.channels.list()) {
      count++
    }

    expect(count).toBe(2)
  })
})

describe('channels.delete()', () => {
  it('DELETEs the channel of the project and resolves with nothing for 204', async () => {
    const { partner, requests } = partnerWith([{ status: 204 }])

    const result = await partner.channels.delete(
      toPartnerProjectId(PROJECT_ID),
      toChannelId(CHANNEL_ID)
    )

    expect(requests[0]?.method).toBe('DELETE')
    expect(requests[0]?.url.pathname).toBe(
      `/v1/partner/projects/${PROJECT_ID}/channels/${CHANNEL_ID}`
    )
    expect(result).toBeUndefined()
  })

  it('throws RoutaConflictError for 409 channel_not_disabled', async () => {
    const { partner } = partnerWith([
      {
        status: 409,
        body: errorEnvelope(
          'conflict_error',
          'channel_not_disabled',
          'Not disabled.'
        ),
      },
    ])

    const failure = await partner.channels
      .delete(toPartnerProjectId(PROJECT_ID), toChannelId(CHANNEL_ID))
      .catch(e => e)

    expect(failure).toBeInstanceOf(RoutaConflictError)
    expect(failure.code).toBe('channel_not_disabled')
  })
})
