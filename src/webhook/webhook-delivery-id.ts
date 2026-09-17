import { type Id, isPrefixedId, toId } from '../domain/branded-id'

const PREFIX = 'whd'

/** Uniquely identifies a WebhookDelivery resource. */
export type WebhookDeliveryId = Id<typeof PREFIX>

/** Narrows `value` to a `WebhookDeliveryId` if it has the expected shape. */
export function isWebhookDeliveryId(value: string): value is WebhookDeliveryId {
  return isPrefixedId(PREFIX, value)
}

/** Casts an already-trusted value (e.g. a parsed API response field) to a `WebhookDeliveryId`. */
export function toWebhookDeliveryId(value: string): WebhookDeliveryId {
  return toId(value)
}
