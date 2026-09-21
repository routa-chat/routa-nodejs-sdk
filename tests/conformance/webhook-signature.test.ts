import { describe, expect, it } from 'vitest'
import { Routa } from '../../src/client'
import { RoutaSignatureVerificationError } from '../../src/domain/errors/routa-signature-verification-error'
import { apiReachable, BASE_URL } from './support/environment'
import { provisionApiKey } from './support/provisioning'
import { loadRealWebhookSigner } from './support/real-webhook-signer'

/**
 * Webhook signature verification against a reference implementation: a real
 * webhook endpoint (created through a locally running reference API server,
 * carrying a real signing secret) and a real payload signed with the actual
 * external webhook-signing implementation — never a hand-rolled stand-in for
 * either side. Skips (never fakes) when the reference API server or the
 * external signing implementation isn't available; see
 * `support/real-webhook-signer.ts` and `support/environment.ts`.
 */
interface FakeEventPayload {
  readonly id: string
  readonly type: string
  readonly api_version: string
  readonly schema_version: number
  readonly project_id: string
  readonly sequence: number
  readonly occurred_at: string
  readonly recorded_at: string
  readonly data: unknown
}

function buildEventPayload(projectId: string): FakeEventPayload {
  const now = new Date().toISOString()
  return {
    id: `evt_${crypto.randomUUID().replace(/-/g, '')}`,
    type: 'message.accepted',
    api_version: 'v1',
    schema_version: 1,
    project_id: projectId,
    sequence: 1,
    occurred_at: now,
    recorded_at: now,
    data: {
      id: 'msg_conformance0000000000000001',
      status: 'accepted',
    },
  }
}

describe('webhook signature — real API server', async () => {
  const signer = await loadRealWebhookSigner()
  const canRun = apiReachable && signer !== undefined

  it.skipIf(!canRun)(
    'accepts a payload signed by the reference signer with a real endpoint secret',
    async () => {
      if (!signer) throw new Error('unreachable — canRun guarantees this')
      const { project, apiKey } = await provisionApiKey(BASE_URL, [
        'webhooks:write',
      ])
      const routa = new Routa({ apiKey: apiKey.secret, baseURL: BASE_URL })

      const webhook = await routa.webhooks.create({
        url: 'https://example.com/hooks/routa-sdk-conformance',
        subscribedTypes: ['message.*'],
      })

      const payload = buildEventPayload(project.projectId)
      const rawBody = JSON.stringify(payload)
      const timestampSeconds = Math.floor(Date.now() / 1000)
      const header = signer.buildSignatureHeader(
        [webhook.secret],
        timestampSeconds,
        new TextEncoder().encode(rawBody)
      )

      const event = await routa.webhooks.constructEvent(
        rawBody,
        header,
        webhook.secret
      )

      expect(event.type).toBe('message.accepted')
      if ('id' in event) {
        expect(event.id).toBe(payload.id)
        expect(event.projectId).toBe(project.projectId)
      }
    }
  )

  it.skipIf(!canRun)(
    'rejects a payload signed with a secret that does not belong to the endpoint',
    async () => {
      if (!signer) throw new Error('unreachable — canRun guarantees this')
      const { project, apiKey } = await provisionApiKey(BASE_URL, [
        'webhooks:write',
      ])
      const routa = new Routa({ apiKey: apiKey.secret, baseURL: BASE_URL })

      const webhook = await routa.webhooks.create({
        url: 'https://example.com/hooks/routa-sdk-conformance',
        subscribedTypes: ['message.*'],
      })

      const payload = buildEventPayload(project.projectId)
      const rawBody = JSON.stringify(payload)
      const timestampSeconds = Math.floor(Date.now() / 1000)
      const header = signer.buildSignatureHeader(
        ['whsec_not_the_real_secret'],
        timestampSeconds,
        new TextEncoder().encode(rawBody)
      )

      await expect(
        routa.webhooks.constructEvent(rawBody, header, webhook.secret)
      ).rejects.toBeInstanceOf(RoutaSignatureVerificationError)
    }
  )

  it.skipIf(!canRun)(
    'secret rotation: a payload signed with the outgoing secret still verifies during the overlap window',
    async () => {
      if (!signer) throw new Error('unreachable — canRun guarantees this')
      const { project, apiKey } = await provisionApiKey(BASE_URL, [
        'webhooks:write',
      ])
      const routa = new Routa({ apiKey: apiKey.secret, baseURL: BASE_URL })

      const created = await routa.webhooks.create({
        url: 'https://example.com/hooks/routa-sdk-conformance',
        subscribedTypes: ['message.*'],
      })
      const outgoingSecret = created.secret

      const rotated = await routa.webhooks.rotateSecret(created.id)
      const newSecret = rotated.secret
      expect(newSecret).not.toBe(outgoingSecret)

      const payload = buildEventPayload(project.projectId)
      const rawBody = JSON.stringify(payload)
      const timestampSeconds = Math.floor(Date.now() / 1000)
      const headerSignedWithOutgoingSecret = signer.buildSignatureHeader(
        [outgoingSecret],
        timestampSeconds,
        new TextEncoder().encode(rawBody)
      )

      // A real receiver mid-rotation does not know which of the two secrets
      // actually signed an incoming delivery — it always checks both.
      const event = await routa.webhooks.constructEvent(
        rawBody,
        headerSignedWithOutgoingSecret,
        [newSecret, outgoingSecret]
      )
      expect(event.type).toBe('message.accepted')

      // Checking only the new secret must fail for a payload the outgoing
      // secret signed — proves this scenario is actually exercising the
      // overlap, not merely accepting any signature unconditionally.
      await expect(
        routa.webhooks.constructEvent(
          rawBody,
          headerSignedWithOutgoingSecret,
          newSecret
        )
      ).rejects.toBeInstanceOf(RoutaSignatureVerificationError)
    }
  )
})
