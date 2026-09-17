import type {
  Webhook,
  WebhookEnableResult,
  WebhookStatus,
  WebhookWithSecret,
} from './webhook'
import { toWebhookId } from './webhook-id'

/** Wire shape of a webhook as returned by the API. */
export interface RawWebhook {
  readonly id: string
  readonly url: string
  readonly subscribed_types: readonly string[]
  readonly api_version: string
  readonly status: WebhookStatus
  readonly consecutive_failures: number
  readonly last_success_at: string | null
  readonly last_failure_at: string | null
  readonly created_at: string
}

/** Wire shape returned by the operations that mint or rotate a signing secret. */
export interface RawWebhookWithSecret extends RawWebhook {
  readonly secret: string
}

/** Wire shape returned by `enable()`. */
export interface RawWebhookEnableResult extends RawWebhook {
  readonly replayed_count: number
}

/** Wire shape of a `GET /v1/webhook_endpoints` page, before its items are parsed into `Webhook`. */
export interface RawWebhookPage {
  readonly data: readonly RawWebhook[]
  readonly has_more: boolean
  readonly next_cursor: string | null
}

/** Turns a raw API webhook into the typed `Webhook` every `webhooks.*` method returns. */
export function parseWebhook(raw: RawWebhook): Webhook {
  return {
    id: toWebhookId(raw.id),
    url: raw.url,
    subscribedTypes: raw.subscribed_types,
    apiVersion: raw.api_version,
    status: raw.status,
    consecutiveFailures: raw.consecutive_failures,
    lastSuccessAt: raw.last_success_at,
    lastFailureAt: raw.last_failure_at,
    createdAt: raw.created_at,
  }
}

/** Same as `parseWebhook`, for the responses that also carry the signing secret. */
export function parseWebhookWithSecret(
  raw: RawWebhookWithSecret
): WebhookWithSecret {
  return { ...parseWebhook(raw), secret: raw.secret }
}

/** Same as `parseWebhook`, for the `enable()` response, which also carries a replay count. */
export function parseWebhookEnableResult(
  raw: RawWebhookEnableResult
): WebhookEnableResult {
  return { ...parseWebhook(raw), replayedCount: raw.replayed_count }
}
