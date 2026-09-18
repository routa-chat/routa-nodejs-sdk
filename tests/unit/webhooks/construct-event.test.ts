import { describe, expect, it } from 'vitest'
import { RoutaSignatureVerificationError } from '../../../src/domain/errors/routa-signature-verification-error'
import type { EventType } from '../../../src/event/event'
import { constructEvent } from '../../../src/webhooks/construct-event'
import { buildSignatureHeader } from '../../../src/webhooks/signature-verifier'

const SECRET = 'whsec_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const ROTATED_SECRET = 'whsec_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function eventBody(overrides: { type?: string; data?: unknown } = {}): string {
  return JSON.stringify({
    id: 'evt_01J8XA1B2C3D4E5F6G7H8J9K0M',
    type: overrides.type ?? 'message.accepted',
    api_version: '2026-01-01',
    schema_version: 1,
    project_id: 'proj_01J8XA1B2C3D4E5F6G7H8J9K0M',
    sequence: 42,
    occurred_at: '2026-09-12T12:00:00.000Z',
    recorded_at: '2026-09-12T12:00:01.000Z',
    data: overrides.data ?? { messageId: 'msg_1' },
  })
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

async function sign(
  body: string,
  secrets: readonly string[],
  timestampSeconds = nowSeconds()
): Promise<string> {
  return buildSignatureHeader(
    secrets,
    timestampSeconds,
    new TextEncoder().encode(body)
  )
}

describe('constructEvent()', () => {
  it('accepts a payload signed by the real algorithm and returns a typed RoutaEvent', async () => {
    const body = eventBody()
    const header = await sign(body, [SECRET])

    const event = await constructEvent(body, header, SECRET)

    expect(event.type).toBe('message.accepted')
    expect(event).toMatchObject({
      id: 'evt_01J8XA1B2C3D4E5F6G7H8J9K0M',
      type: 'message.accepted',
      data: { messageId: 'msg_1' },
    })
  })

  it('rejects a tampered body', async () => {
    const body = eventBody({ data: { messageId: 'msg_1' } })
    const header = await sign(body, [SECRET])
    const tamperedBody = eventBody({ data: { messageId: 'msg_ATTACKER' } })

    await expect(constructEvent(tamperedBody, header, SECRET)).rejects.toThrow(
      RoutaSignatureVerificationError
    )
  })

  it('rejects a timestamp outside the 5-minute tolerance', async () => {
    const body = eventBody()
    const header = await sign(body, [SECRET], nowSeconds() - 6 * 60)

    await expect(constructEvent(body, header, SECRET)).rejects.toThrow(
      RoutaSignatureVerificationError
    )
  })

  it('rejects a malformed signature header', async () => {
    const body = eventBody()

    await expect(
      constructEvent(body, 'not-a-signature-header', SECRET)
    ).rejects.toThrow(RoutaSignatureVerificationError)
    await expect(constructEvent(body, null, SECRET)).rejects.toThrow(
      RoutaSignatureVerificationError
    )
  })

  it('rejects a payload signed with the wrong secret', async () => {
    const body = eventBody()
    const header = await sign(body, ['whsec_wrongwrongwrongwrongwrongwrong'])

    await expect(constructEvent(body, header, SECRET)).rejects.toThrow(
      RoutaSignatureVerificationError
    )
  })

  it('rejects a body that was re-serialized instead of the literal raw bytes (the raw-body trap)', async () => {
    const originalBody = JSON.stringify({
      id: 'evt_01J8XA1B2C3D4E5F6G7H8J9K0M',
      type: 'message.accepted',
      api_version: '2026-01-01',
      schema_version: 1,
      project_id: 'proj_01J8XA1B2C3D4E5F6G7H8J9K0M',
      sequence: 42,
      occurred_at: '2026-09-12T12:00:00.000Z',
      recorded_at: '2026-09-12T12:00:01.000Z',
      data: { b: 2, a: 1 },
    })
    const header = await sign(originalBody, [SECRET])

    // Re-serializing (even parsing then re-stringifying the exact same
    // object) is not guaranteed to reproduce the original byte sequence —
    // here, pretty-printing changes every byte of whitespace.
    const reserialized = JSON.stringify(JSON.parse(originalBody), null, 2)
    expect(reserialized).not.toBe(originalBody)

    await expect(constructEvent(reserialized, header, SECRET)).rejects.toThrow(
      RoutaSignatureVerificationError
    )
    // The literal original bytes still verify under the same header.
    await expect(
      constructEvent(originalBody, header, SECRET)
    ).resolves.toBeDefined()
  })

  it('accepts a payload signed with an old secret while both secrets are active during rotation', async () => {
    const body = eventBody()
    const header = await sign(body, [ROTATED_SECRET])

    const event = await constructEvent(body, header, [SECRET, ROTATED_SECRET])
    expect(event.type).toBe('message.accepted')

    // The header may also carry a v1= for every active secret at once.
    const bothHeader = await sign(body, [SECRET, ROTATED_SECRET])
    expect(
      bothHeader.split(',').filter(part => part.startsWith('v1='))
    ).toHaveLength(2)
    await expect(
      constructEvent(body, bothHeader, SECRET)
    ).resolves.toBeDefined()
    await expect(
      constructEvent(body, bothHeader, ROTATED_SECRET)
    ).resolves.toBeDefined()
  })

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

  it.each(KNOWN_EVENT_TYPES)('parses the real event type %s', async type => {
    const body = eventBody({ type })
    const header = await sign(body, [SECRET])

    const event = await constructEvent(body, header, SECRET)

    expect(event.type).toBe(type)
    expect('id' in event).toBe(true)
  })

  it('falls back to the generic shape for an unknown event type instead of throwing', async () => {
    const body = eventBody({ type: 'something.unknown' })
    const header = await sign(body, [SECRET])

    const event = await constructEvent(body, header, SECRET)

    expect(event).toEqual({
      type: 'something.unknown',
      data: { messageId: 'msg_1' },
    })
  })
})
