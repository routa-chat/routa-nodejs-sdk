import type { WebhookDeliveryState } from './webhook-delivery'
import type { RawWebhookDelivery } from './webhook-delivery-mapper'

/** Filters accepted by `webhooks.deliveries.list()` — mirrors the query params of `GET /v1/webhook_endpoints/:id/deliveries`. */
export interface ListWebhookDeliveriesParams {
  readonly state?: WebhookDeliveryState
  /** Max items per page (1-100). */
  readonly limit?: number
  readonly cursor?: string
}

/** Wire shape of a deliveries page, before its items are parsed into `WebhookDelivery`. */
export interface RawWebhookDeliveryPage {
  readonly data: readonly RawWebhookDelivery[]
  readonly has_more: boolean
  readonly next_cursor: string | null
}
