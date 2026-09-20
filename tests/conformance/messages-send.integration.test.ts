import { describe, expect, it } from 'vitest'
import { Routa } from '../../src/client'

/**
 * Real integration test against a locally running reference API server (the
 * same instance used to capture the SDK's captured OpenAPI snapshot) — no
 * mocked `fetch` anywhere in this file. It is skipped, never faked, when
 * that instance isn't reachable or configured, so a missing local instance
 * shows up as a skipped test instead of a false pass.
 *
 * Configure via environment variables:
 *   ROUTA_TEST_BASE_URL    - defaults to http://localhost:3000
 *   ROUTA_TEST_API_KEY     - a real API key for that instance
 *   ROUTA_TEST_CHANNEL_ID  - an active channel id to send through
 *   ROUTA_TEST_TO          - an E.164 recipient the channel is allowed to message
 */
const BASE_URL = process.env['ROUTA_TEST_BASE_URL'] ?? 'http://localhost:3000'
const API_KEY = process.env['ROUTA_TEST_API_KEY']
const CHANNEL_ID = process.env['ROUTA_TEST_CHANNEL_ID']
const TO = process.env['ROUTA_TEST_TO']

async function isApiReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/docs/json`, {
      signal: AbortSignal.timeout(1000),
    })
    return response.ok
  } catch {
    return false
  }
}

const apiReachable = await isApiReachable()
const isFullyConfigured =
  API_KEY !== undefined && CHANNEL_ID !== undefined && TO !== undefined
const canRunLiveTest = apiReachable && isFullyConfigured

describe('messages.send() — integration against a local API server', () => {
  it.skipIf(!canRunLiveTest)(
    'accepts a real send: status "accepted", acceptedAt set, every other timestamp null',
    async () => {
      if (!API_KEY || !CHANNEL_ID || !TO) {
        throw new Error(
          'unreachable — canRunLiveTest already guarantees these are set'
        )
      }

      const routa = new Routa({ apiKey: API_KEY, baseURL: BASE_URL })

      const message = await routa.messages.send({
        channel: CHANNEL_ID,
        to: TO,
        text: `Routa SDK — Phase 03 integration test ${new Date().toISOString()}`,
      })

      expect(message.status).toBe('accepted')
      expect(message.acceptedAt).not.toBeNull()
      expect(typeof message.acceptedAt).toBe('string')
      expect(message.sentAt).toBeNull()
      expect(message.deliveredAt).toBeNull()
      expect(message.readAt).toBeNull()
      expect(message.failedAt).toBeNull()
    }
  )
})
