import type { WebhookId } from './webhook-id'

/** Whether a webhook is currently receiving deliveries. */
export type WebhookStatus =
  | 'enabled'
  | 'disabled_by_user'
  | 'disabled_by_system'

/** A registered destination Routa delivers webhook events to. */
export interface Webhook {
  readonly id: WebhookId
  readonly url: string
  readonly subscribedTypes: readonly string[]
  readonly apiVersion: string
  readonly status: WebhookStatus
  readonly consecutiveFailures: number
  readonly lastSuccessAt: string | null
  readonly lastFailureAt: string | null
  readonly createdAt: string
}

/**
 * A `Webhook` as returned by the two operations that mint or rotate its
 * signing secret (`create`, `rotateSecret`) — every other read omits the
 * secret, since it is shown once and never re-displayed afterwards.
 */
export interface WebhookWithSecret extends Webhook {
  readonly secret: string
}

/** A `Webhook` as returned by `enable()`, which also bulk-replays every exhausted delivery. */
export interface WebhookEnableResult extends Webhook {
  readonly replayedCount: number
}
