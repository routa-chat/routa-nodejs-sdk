import { describe, expect, it } from 'vitest'
import { Routa } from '../../src/client'
import {
  BASE_URL,
  hasChannelFixture,
  requireChannelFixture,
} from './support/environment'

/**
 * Idempotency, end to end against a real, locally running API instance — no mocked
 * `fetch` stands in for the server anywhere in this file. Skipped, never
 * faked, when that instance or its channel fixture isn't configured; see
 * `support/environment.ts` for the required variables.
 */

describe('idempotency — explicit key', () => {
  it.skipIf(!hasChannelFixture)(
    'an explicit idempotencyKey reused on an identical resend returns the same message, with Idempotent-Replay observable as _replayed',
    async () => {
      const { apiKey, channelId, to } = requireChannelFixture()
      const routa = new Routa({ apiKey, baseURL: BASE_URL })
      const idempotencyKey = `conformance-explicit-${crypto.randomUUID()}`
      const text = `Routa SDK conformance — explicit key ${idempotencyKey}`

      const first = await routa.messages.send({
        channel: channelId,
        to,
        text,
        idempotencyKey,
      })
      const second = await routa.messages.send({
        channel: channelId,
        to,
        text,
        idempotencyKey,
      })

      expect(first.status).toBe('accepted')
      expect(first._replayed).toBe(false)
      expect(second.id).toBe(first.id)
      expect(second.acceptedAt).toBe(first.acceptedAt)
      expect(second.content).toEqual(first.content)
      expect(second._replayed).toBe(true)
    }
  )
})

describe('idempotency — retry after a lost response', () => {
  it.skipIf(!hasChannelFixture)(
    "a response lost after the server already processed the write still yields exactly one message, replayed on the SDK's own retry with the same auto-generated key",
    async () => {
      const { apiKey, channelId, to } = requireChannelFixture()
      const realFetch = fetch

      // Simulates the exact ambiguous-timeout scenario the SDK's reliability
      // documentation describes: the server receives and fully processes the first attempt
      // (we await its real response before discarding it), but the client
      // never observes that response — indistinguishable, from the SDK's
      // point of view, from the response being lost in transit. The second
      // attempt is a genuinely separate HTTP request the SDK's own retry
      // loop makes, not a canned response.
      let attempt = 0
      const keysSent: Array<string | undefined> = []
      const flakyFetch: typeof fetch = async (input, init) => {
        attempt += 1
        const headers = init?.headers as Record<string, string> | undefined
        keysSent.push(headers?.['Idempotency-Key'])
        if (attempt === 1) {
          await realFetch(input, init)
          throw new TypeError(
            'simulated: response lost after the server already committed the write'
          )
        }
        return realFetch(input, init)
      }

      const routa = new Routa({
        apiKey,
        baseURL: BASE_URL,
        fetch: flakyFetch,
      })

      const text = `Routa SDK conformance — lost response ${crypto.randomUUID()}`
      const message = await routa.messages.send({
        channel: channelId,
        to,
        text,
      })

      expect(attempt).toBe(2)
      expect(keysSent).toHaveLength(2)
      expect(keysSent[0]).toBeTruthy()
      expect(keysSent[1]).toBe(keysSent[0])

      expect(message.status).toBe('accepted')
      expect(message._replayed).toBe(true)

      const fetched = await routa.messages.retrieve(message.id)
      expect(fetched.content).toEqual({ type: 'text', body: text })
    }
  )
})
