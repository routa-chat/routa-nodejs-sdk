import type { Page } from '../domain/pagination'
import type { RoutaEvent } from '../event/event'
import type { HttpClient } from '../http/http-client'
import {
  constructEvent,
  type WebhookSigningSecret,
} from '../webhooks/construct-event'
import {
  type CreateWebhookParams,
  serializeCreateWebhookParams,
} from './create-webhook'
import {
  serializeUpdateWebhookParams,
  type UpdateWebhookParams,
} from './update-webhook'
import type { Webhook, WebhookEnableResult, WebhookWithSecret } from './webhook'
import { WebhookDeliveriesResource } from './webhook-deliveries-resource'
import type { WebhookId } from './webhook-id'
import {
  parseWebhook,
  parseWebhookEnableResult,
  parseWebhookWithSecret,
  type RawWebhook,
  type RawWebhookEnableResult,
  type RawWebhookPage,
  type RawWebhookWithSecret,
} from './webhook-mapper'

/**
 * `routa.webhooks.*` — create, read, and manage webhooks. Orchestrates `http`
 * — no transport logic of its own.
 */
export class WebhooksResource {
  /** `routa.webhooks.deliveries.*` — the dead-letter query surface for each webhook. */
  readonly deliveries: WebhookDeliveriesResource

  constructor(private readonly http: HttpClient) {
    this.deliveries = new WebhookDeliveriesResource(http)
  }

  async create(params: CreateWebhookParams): Promise<WebhookWithSecret> {
    const raw = await this.http.request<RawWebhookWithSecret>({
      method: 'POST',
      path: '/v1/webhook_endpoints',
      body: serializeCreateWebhookParams(params),
    })
    return parseWebhookWithSecret(raw)
  }

  /** Lists every webhook on the project — at most 5 per project, so this is never paginated. */
  async list(): Promise<Page<Webhook>> {
    const raw = await this.http.request<RawWebhookPage>({
      method: 'GET',
      path: '/v1/webhook_endpoints',
    })
    return {
      data: raw.data.map(parseWebhook),
      hasMore: raw.has_more,
      nextCursor: raw.next_cursor,
    }
  }

  async retrieve(id: WebhookId): Promise<Webhook> {
    const raw = await this.http.request<RawWebhook>({
      method: 'GET',
      path: `/v1/webhook_endpoints/${id}`,
    })
    return parseWebhook(raw)
  }

  async update(id: WebhookId, params: UpdateWebhookParams): Promise<Webhook> {
    const raw = await this.http.request<RawWebhook>({
      method: 'PATCH',
      path: `/v1/webhook_endpoints/${id}`,
      body: serializeUpdateWebhookParams(params),
    })
    return parseWebhook(raw)
  }

  /** Re-enables a webhook — the real API also bulk-replays every exhausted delivery as a side effect of this call. */
  async enable(id: WebhookId): Promise<WebhookEnableResult> {
    const raw = await this.http.request<RawWebhookEnableResult>({
      method: 'POST',
      path: `/v1/webhook_endpoints/${id}/enable`,
    })
    return parseWebhookEnableResult(raw)
  }

  async disable(id: WebhookId): Promise<Webhook> {
    const raw = await this.http.request<RawWebhook>({
      method: 'POST',
      path: `/v1/webhook_endpoints/${id}/disable`,
    })
    return parseWebhook(raw)
  }

  /** Rotates the signing secret — the old secret stays valid for a 24h overlap window. */
  async rotateSecret(id: WebhookId): Promise<WebhookWithSecret> {
    const raw = await this.http.request<RawWebhookWithSecret>({
      method: 'POST',
      path: `/v1/webhook_endpoints/${id}/rotate_secret`,
    })
    return parseWebhookWithSecret(raw)
  }

  /**
   * Verifies a webhook delivery and returns its typed `RoutaEvent` — the
   * only method on this namespace that makes no network call, since
   * verification runs locally over bytes the caller already received. See
   * `constructEvent()`'s own documentation for the raw-body requirement.
   */
  constructEvent(
    rawBody: string | Uint8Array,
    signatureHeader: string | null,
    secret: WebhookSigningSecret
  ): Promise<RoutaEvent> {
    return constructEvent(rawBody, signatureHeader, secret)
  }
}
