import type { WebhookDeliveryId } from './webhook-delivery-id'

/** Where a single delivery attempt sits in the retry lifecycle. */
export type WebhookDeliveryState =
  | 'pending'
  | 'in_flight'
  | 'retrying'
  | 'succeeded'
  | 'exhausted'

/** One attempt to deliver an event to a webhook. */
export interface WebhookDelivery {
  readonly id: WebhookDeliveryId
  /** Id of the event this delivery carries. Not a branded id here — a delivery only references an event, it does not own one. */
  readonly eventId: string
  readonly eventType: string
  readonly state: WebhookDeliveryState
  readonly attemptCount: number
  readonly nextAttemptAt: string
  readonly lastResponseStatus: number | null
  readonly lastErrorCode: string | null
  readonly succeededAt: string | null
  readonly exhaustedAt: string | null
  readonly createdAt: string
}

/** Result of replaying one or more exhausted deliveries. */
export interface ReplayDeliveriesResult {
  readonly replayedCount: number
}
