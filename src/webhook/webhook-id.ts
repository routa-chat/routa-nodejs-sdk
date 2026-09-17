import { type Id, isPrefixedId, toId } from '../domain/branded-id'

const PREFIX = 'whe'

/** Uniquely identifies a Webhook resource. */
export type WebhookId = Id<typeof PREFIX>

/** Narrows `value` to a `WebhookId` if it has the expected shape. */
export function isWebhookId(value: string): value is WebhookId {
  return isPrefixedId(PREFIX, value)
}

/** Casts an already-trusted value (e.g. a parsed API response field) to a `WebhookId`. */
export function toWebhookId(value: string): WebhookId {
  return toId(value)
}
