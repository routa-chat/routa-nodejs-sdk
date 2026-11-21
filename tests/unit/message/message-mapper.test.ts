import { describe, expect, it } from 'vitest'
import {
  parseMessage,
  type RawMessage,
} from '../../../src/message/message-mapper'

const REDACTED_AT = '2026-10-23T03:00:00.000Z'

function rawMessage(overrides: Partial<RawMessage> = {}): RawMessage {
  return {
    id: 'msg_01J8XA1B2C3D4E5F6G7H8J9K0M',
    channel: 'chan_01J8XA1B2C3D4E5F6G7H8J9K0M',
    direction: 'inbound',
    origin: null,
    from: '+15550001111',
    to: '+15550002222',
    content: { type: 'text', body: 'Hello from Routa' },
    status: 'read',
    failure_code: null,
    metadata: { orderId: '42' },
    accepted_at: '2026-08-01T12:00:00.000Z',
    sent_at: null,
    delivered_at: null,
    read_at: null,
    failed_at: null,
    content_redacted_at: null,
    ...overrides,
  }
}

describe('parseMessage() — content removed by plan retention', () => {
  it('does not throw on content: null and exposes content_redacted_at', () => {
    const raw = rawMessage({ content: null, content_redacted_at: REDACTED_AT })

    const message = parseMessage(raw)

    expect(message.content).toBeNull()
    expect(message.contentRedactedAt).toBe(REDACTED_AT)
  })

  it('keeps everything else about a redacted message', () => {
    const message = parseMessage(
      rawMessage({ content: null, content_redacted_at: REDACTED_AT })
    )

    expect(message.id).toBe('msg_01J8XA1B2C3D4E5F6G7H8J9K0M')
    expect(message.status).toBe('read')
    expect(message.metadata).toEqual({ orderId: '42' })
    expect(message.acceptedAt).toBe('2026-08-01T12:00:00.000Z')
  })

  it('returns contentRedactedAt: null for a message that still has content', () => {
    const message = parseMessage(rawMessage())

    expect(message.content).toEqual({ type: 'text', body: 'Hello from Routa' })
    expect(message.contentRedactedAt).toBeNull()
  })

  it('falls back to null when an older API omits content_redacted_at', () => {
    const { content_redacted_at: _omitted, ...withoutField } = rawMessage()

    const message = parseMessage(withoutField)

    expect(message.contentRedactedAt).toBeNull()
  })

  it('still rejects a content type it does not know', () => {
    const raw = rawMessage({
      content: { type: 'hologram' } as unknown as RawMessage['content'],
    })

    expect(() => parseMessage(raw)).toThrow('Unknown message content type')
  })
})

describe('parseMessage() — origin', () => {
  it.each(['api', 'business_app'] as const)(
    'exposes origin %s on an outbound message',
    origin => {
      const message = parseMessage(
        rawMessage({ direction: 'outbound', origin })
      )

      expect(message.origin).toBe(origin)
    }
  )

  it('keeps origin null on an inbound message', () => {
    const message = parseMessage(
      rawMessage({ direction: 'inbound', origin: null })
    )

    expect(message.origin).toBeNull()
  })
})

describe('parseMessage() — failureCode', () => {
  it('exposes the failure code of a failed message as the plain string the API sends', () => {
    const message = parseMessage(
      rawMessage({
        direction: 'outbound',
        origin: 'api',
        status: 'failed',
        failure_code: 'provider_rejected_request',
        failed_at: '2026-08-01T12:00:05.000Z',
      })
    )

    expect(message.status).toBe('failed')
    expect(message.failureCode).toBe('provider_rejected_request')
  })

  it('keeps a failure code this SDK has never seen instead of dropping it', () => {
    const message = parseMessage(
      rawMessage({ status: 'failed', failure_code: 'a_code_from_the_future' })
    )

    expect(message.failureCode).toBe('a_code_from_the_future')
  })

  it('is null for a message that did not fail', () => {
    expect(parseMessage(rawMessage()).failureCode).toBeNull()
  })
})
