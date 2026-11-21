import type { HttpClient } from '../../http/http-client'
import type { Webhook, WebhookWithSecret } from '../../webhook/webhook'
import {
  parseWebhook,
  parseWebhookWithSecret,
  type RawWebhook,
  type RawWebhookWithSecret,
} from '../../webhook/webhook-mapper'
import {
  type PartnerWebhookSetResult,
  type SetPartnerWebhookParams,
  serializeSetPartnerWebhookParams,
} from './set-partner-webhook'

/**
 * `partner.webhook.*` — the organization's one webhook, which receives the
 * events of **all** the partner's customers (each carries `project_id` and
 * `external_ref`, so a partner routes by its own id). Needs the
 * `webhooks:write` scope, even to read it: the API has no read-only webhook
 * scope. Orchestrates `http` — no transport logic of its own.
 *
 * It returns the same `Webhook` as `routa.webhooks.*` and is verified the
 * same way, with `constructEvent()`.
 */
export class PartnerWebhookResource {
  constructor(private readonly http: HttpClient) {}

  /** Reads the webhook. `404 webhook_endpoint_not_found` until `set()` has been called. */
  async retrieve(): Promise<Webhook> {
    const raw = await this.http.request<RawWebhook>({
      method: 'GET',
      path: '/v1/partner/webhook',
    })
    return parseWebhook(raw)
  }

  /**
   * Sets the organization's one webhook: created, with its signing secret
   * (shown once), the first time; replaced — and re-enabled — after that.
   */
  async set(params: SetPartnerWebhookParams): Promise<PartnerWebhookSetResult> {
    const { data, status } = await this.http.requestWithHeaders<
      RawWebhook | RawWebhookWithSecret
    >({
      method: 'PUT',
      path: '/v1/partner/webhook',
      body: serializeSetPartnerWebhookParams(params),
    })
    if (status === 201 && 'secret' in data) {
      return { webhook: parseWebhook(data), secret: data.secret }
    }
    return { webhook: parseWebhook(data) }
  }

  /** Issues a new signing secret and returns it, once. The previous secret keeps signing for 24 hours, so a receiver can switch over without dropping events. */
  async rotateSecret(): Promise<WebhookWithSecret> {
    const raw = await this.http.request<RawWebhookWithSecret>({
      method: 'POST',
      path: '/v1/partner/webhook/rotate_secret',
    })
    return parseWebhookWithSecret(raw)
  }
}
