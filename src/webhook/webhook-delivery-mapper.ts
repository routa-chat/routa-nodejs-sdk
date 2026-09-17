import type {
  ReplayDeliveriesResult,
  WebhookDelivery,
  WebhookDeliveryState,
} from './webhook-delivery'
import { toWebhookDeliveryId } from './webhook-delivery-id'

/** Wire shape of a webhook delivery as returned by the API. */
export interface RawWebhookDelivery {
  readonly id: string
  readonly event_id: string
  readonly event_type: string
  readonly state: WebhookDeliveryState
  readonly attempt_count: number
  readonly next_attempt_at: string
  readonly last_response_status: number | null
  readonly last_error_code: string | null
  readonly succeeded_at: string | null
  readonly exhausted_at: string | null
  readonly created_at: string
}

/** Wire shape of a replay response — both the bulk and the single-delivery replay routes return this. */
export interface RawReplayDeliveriesResult {
  readonly replayed_count: number
}

/** Turns a raw API delivery into the typed `WebhookDelivery` every `webhooks.deliveries.*` method returns. */
export function parseWebhookDelivery(raw: RawWebhookDelivery): WebhookDelivery {
  return {
    id: toWebhookDeliveryId(raw.id),
    eventId: raw.event_id,
    eventType: raw.event_type,
    state: raw.state,
    attemptCount: raw.attempt_count,
    nextAttemptAt: raw.next_attempt_at,
    lastResponseStatus: raw.last_response_status,
    lastErrorCode: raw.last_error_code,
    succeededAt: raw.succeeded_at,
    exhaustedAt: raw.exhausted_at,
    createdAt: raw.created_at,
  }
}

/** Turns a raw replay response into the typed `ReplayDeliveriesResult`. */
export function parseReplayDeliveriesResult(
  raw: RawReplayDeliveriesResult
): ReplayDeliveriesResult {
  return { replayedCount: raw.replayed_count }
}
