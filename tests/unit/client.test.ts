import { describe, expect, it, vi } from 'vitest'
import { Routa } from '../../src/client'
import { RoutaInvalidRequestError } from '../../src/domain/errors/routa-invalid-request-error'
import { toMessageId } from '../../src/message/message-id'

describe('Routa', () => {
  it('throws synchronously without making any network request when apiKey is missing', () => {
    const fetchSpy = vi.fn()

    // @ts-expect-error — apiKey is required; this exercises the runtime
    // guard a plain-JavaScript caller would still be able to trigger.
    expect(() => new Routa({ fetch: fetchSpy })).toThrow(/apiKey/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('constructs successfully when apiKey is provided', () => {
    expect(() => new Routa({ apiKey: 'rt_test_123' })).not.toThrow()
  })

  it('accepts a plain apiKey string as shorthand for { apiKey }', () => {
    const routa = new Routa('rt_test_123')

    expect(routa.messages).toBeDefined()
    expect(routa.webhooks).toBeDefined()
  })

  it('throws synchronously when the shorthand apiKey string is empty', () => {
    expect(() => new Routa('')).toThrow(/apiKey/)
  })

  it('wires every public resource namespace', () => {
    const routa = new Routa({ apiKey: 'rt_test_123' })

    expect(routa.messages).toBeDefined()
    expect(routa.events).toBeDefined()
    expect(routa.media).toBeDefined()
    expect(routa.webhooks).toBeDefined()
    expect(routa.webhooks.deliveries).toBeDefined()
    expect(routa.templates).toBeDefined()
    expect(routa.usage).toBeDefined()
    expect(typeof routa.whoami).toBe('function')
  })
})

describe('Routa.whoami', () => {
  it('resolves the calling API key through the real transport wired by the Routa constructor', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          organization_id: 'org_1',
          project_id: 'proj_1',
          api_key_id: 'key_1',
          scopes: ['messages:read', 'messages:write'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    const routa = new Routa({ apiKey: 'rt_test_123', fetch: fetchSpy })

    const result = await routa.whoami()

    expect(result).toEqual({
      organizationId: 'org_1',
      projectId: 'proj_1',
      apiKeyId: 'key_1',
      scopes: ['messages:read', 'messages:write'],
    })
    const [url, init] = fetchSpy.mock.calls[0] ?? []
    expect(url).toBe('https://api.routa.chat/v1/whoami')
    expect(init?.method).toBe('GET')
  })
})

describe('Routa.messages', () => {
  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('sends a message through the real transport wired by the Routa constructor', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          id: 'msg_01J8XA1B2C3D4E5F6G7H8J9K0M',
          channel: 'chan_1',
          direction: 'outbound',
          from: '+15550001111',
          to: '+15550002222',
          content: { type: 'text', body: 'Hello from Routa' },
          status: 'accepted',
          metadata: {},
          accepted_at: '2026-09-12T12:00:00.000Z',
          sent_at: null,
          delivered_at: null,
          read_at: null,
          failed_at: null,
        },
        202
      )
    )
    const routa = new Routa({ apiKey: 'rt_test_123', fetch: fetchSpy })

    const message = await routa.messages.send({
      channel: 'chan_1',
      to: '+15550002222',
      text: 'Hello from Routa',
    })

    expect(message.status).toBe('accepted')
    expect(message.acceptedAt).toBe('2026-09-12T12:00:00.000Z')

    const [url, init] = fetchSpy.mock.calls[0] ?? []
    expect(url).toBe('https://api.routa.chat/v1/messages')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      channel: 'chan_1',
      to: '+15550002222',
      text: 'Hello from Routa',
    })
  })

  it('surfaces a real error response as the matching RoutaApiError subtype', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            type: 'invalid_request_error',
            code: 'content_rejected',
            message: 'text is required when template is not provided',
            param: 'text',
            request_id: 'req_1',
          },
        }),
        { status: 422, headers: { 'Routa-Request-Id': 'req_1' } }
      )
    )
    const routa = new Routa({ apiKey: 'rt_test_123', fetch: fetchSpy })
    const messageId = toMessageId('msg_01J8XA1B2C3D4E5F6G7H8J9K0M')

    await expect(routa.messages.retrieve(messageId)).rejects.toMatchObject({
      code: 'content_rejected',
      param: 'text',
      requestId: 'req_1',
    })
    await expect(routa.messages.retrieve(messageId)).rejects.toBeInstanceOf(
      RoutaInvalidRequestError
    )
  })
})
