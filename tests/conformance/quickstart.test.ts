import { describe, expect, it } from 'vitest'
// The published package is `@routa-chat/sdk`; inside this package's own repo
// there is nothing to install it from, so this imports the same `Routa`
// export by relative path instead — the one substitution literally required
// to run this file at all. Everything below it is the SDK's own documented
// Quickstart, unchanged in structure: same constructor call, same `send()`
// call shape, same destructured `console.log`.
import { Routa } from '../../src/client'
import {
  BASE_URL,
  hasChannelFixture,
  requireChannelFixture,
} from './support/environment'

describe('Quickstart — documented quickstart, run literally', () => {
  it.skipIf(!hasChannelFixture)(
    'sending the documented first message reaches status "accepted"',
    async () => {
      const { apiKey, channelId, to } = requireChannelFixture()
      process.env['ROUTA_API_KEY'] = apiKey
      const configuredApiKey = process.env['ROUTA_API_KEY']
      if (!configuredApiKey) {
        throw new Error('unreachable — set immediately above')
      }

      // --- Quickstart code begins ---
      const routa = new Routa({
        apiKey: configuredApiKey,
        // Not part of the documented Quickstart — points the client at this
        // local reference API instance instead of the (still-undecided)
        // production default.
        baseURL: BASE_URL,
      })

      const message = await routa.messages.send({
        channel: channelId, // criado no dashboard
        to,
        text: 'Olá! Seu pedido foi confirmado.',
      })

      // biome-ignore lint/suspicious/noConsole: this line is the literal Quickstart code from the SDK's documented quickstart.
      console.log(message.id, message.status) // "msg_01J8...", "accepted"
      // --- Quickstart code ends ---

      expect(message.id).toMatch(/^msg_/)
      expect(message.status).toBe('accepted')
    }
  )
})
