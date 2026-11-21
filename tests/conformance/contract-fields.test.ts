import { describe, expect, it } from 'vitest'
import { Routa } from '../../src/client'
import type { RoutaEvent } from '../../src/event/event'
import {
  BASE_URL,
  hasChannelFixture,
  requireChannelFixture,
} from './support/environment'

/**
 * Fields the API added to messages and events (contract refresh, Phase 09),
 * read from a real response. Both scenarios need a message to be accepted, so
 * they use the pre-provisioned channel (`ROUTA_TEST_*`, see `environment.ts`)
 * and are skipped without it, like the other channel scenarios. The key needs
 * `messages:write`, `messages:read` and `events:read`.
 *
 * Each run sends one real message through that channel.
 */
function fixtureClient(): { routa: Routa; channel: string; to: string } {
  const { apiKey, channelId, to } = requireChannelFixture()
  return {
    routa: new Routa({ apiKey, baseURL: BASE_URL, maxRetries: 0 }),
    channel: channelId,
    to,
  }
}

describe.skipIf(!hasChannelFixture)(
  'message and event fields — real API server, real channel',
  () => {
    it('a message sent through the API has origin "api" and, while it has not failed, failureCode null', async () => {
      const { routa, channel, to } = fixtureClient()

      const sent = await routa.messages.send({
        channel,
        to,
        text: `Routa SDK — conformance, message fields ${new Date().toISOString()}`,
      })

      expect(sent.direction).toBe('outbound')
      expect(sent.origin).toBe('api')
      expect(sent.status).toBe('accepted')
      expect(sent.failureCode).toBeNull()

      // The same fields on the read paths, not only on the send response.
      const retrieved = await routa.messages.retrieve(sent.id)
      expect(retrieved.origin).toBe('api')
      expect(retrieved.failureCode).toBeNull()

      const listed = await routa.messages.list({ limit: 20 }).page()
      const found = listed.data.find(message => message.id === sent.id)
      expect(found?.origin).toBe('api')
      expect(found?.failureCode).toBeNull()
    })

    it('every event carries externalRef — null for a project that was not made by a partner', async () => {
      const { routa, channel, to } = fixtureClient()
      await routa.messages.send({
        channel,
        to,
        text: `Routa SDK — conformance, event fields ${new Date().toISOString()}`,
      })

      // Recording the event is the API's job, not the request's: give it a moment.
      let events: readonly RoutaEvent[] = []
      for (let attempt = 0; attempt < 10 && events.length === 0; attempt++) {
        events = (await routa.events.list({ limit: 20 }).page()).data
        if (events.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      expect(events.length).toBeGreaterThan(0)
      for (const event of events) {
        // A type this SDK does not know is the generic member, which has no envelope.
        if ('externalRef' in event) {
          // Always present, never `undefined`: the SDK turns an absent
          // `external_ref` into `null`. A fixture project is a regular
          // dashboard project, so it has none.
          expect(event.externalRef).toBeNull()
        }
      }
      expect(events.some(event => 'externalRef' in event)).toBe(true)
    })
  }
)
