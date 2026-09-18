import type { Page } from '../domain/pagination'
import type { HttpClient } from '../http/http-client'
import type {
  ListWebhookDeliveriesParams,
  RawWebhookDeliveryPage,
} from './list-webhook-deliveries'
import type {
  ReplayDeliveriesResult,
  WebhookDelivery,
} from './webhook-delivery'
import type { WebhookDeliveryId } from './webhook-delivery-id'
import {
  parseReplayDeliveriesResult,
  parseWebhookDelivery,
  type RawReplayDeliveriesResult,
} from './webhook-delivery-mapper'
import type { WebhookId } from './webhook-id'

/**
 * `routa.webhooks.deliveries.*` — the dead-letter query surface for one
 * webhook. Orchestrates `http` — no transport logic of its own.
 */
export class WebhookDeliveriesResource {
  constructor(private readonly http: HttpClient) {}

  list(
    webhookId: WebhookId,
    params: ListWebhookDeliveriesParams = {}
  ): AsyncIterable<WebhookDelivery> & {
    page(): Promise<Page<WebhookDelivery>>
  } {
    const fetchPage = (
      cursor: string | undefined
    ): Promise<Page<WebhookDelivery>> =>
      this.fetchDeliveriesPage(webhookId, params, cursor)

    return {
      page: () => fetchPage(params.cursor),
      [Symbol.asyncIterator]: (): AsyncIterator<WebhookDelivery> => {
        let cursor = params.cursor
        let exhausted = false
        const queue: WebhookDelivery[] = []

        return {
          async next(): Promise<IteratorResult<WebhookDelivery>> {
            while (queue.length === 0 && !exhausted) {
              const page = await fetchPage(cursor)
              queue.push(...page.data)
              if (page.hasMore && page.nextCursor !== null) {
                cursor = page.nextCursor
              } else {
                exhausted = true
              }
            }

            const value = queue.shift()
            if (value === undefined) {
              return { done: true, value: undefined }
            }
            return { done: false, value }
          },
        }
      },
    }
  }

  /**
   * Replays exhausted deliveries. Replays a single delivery when `deliveryId`
   * is given, or bulk-replays every exhausted delivery for the webhook
   * otherwise — the real API exposes these as two separate routes, unified
   * here into one method.
   */
  async replay(
    webhookId: WebhookId,
    deliveryId?: WebhookDeliveryId
  ): Promise<ReplayDeliveriesResult> {
    const path =
      deliveryId !== undefined
        ? `/v1/webhook_endpoints/${webhookId}/deliveries/${deliveryId}/replay`
        : `/v1/webhook_endpoints/${webhookId}/deliveries/replay`

    const raw = await this.http.request<RawReplayDeliveriesResult>({
      method: 'POST',
      path,
    })
    return parseReplayDeliveriesResult(raw)
  }

  private async fetchDeliveriesPage(
    webhookId: WebhookId,
    params: ListWebhookDeliveriesParams,
    cursor: string | undefined
  ): Promise<Page<WebhookDelivery>> {
    const searchParams: Record<string, string> = {}
    if (params.state !== undefined) {
      searchParams['state'] = params.state
    }
    if (params.limit !== undefined) {
      searchParams['limit'] = String(params.limit)
    }
    if (cursor !== undefined) {
      searchParams['cursor'] = cursor
    }

    const raw = await this.http.request<RawWebhookDeliveryPage>({
      method: 'GET',
      path: `/v1/webhook_endpoints/${webhookId}/deliveries`,
      searchParams,
    })

    return {
      data: raw.data.map(parseWebhookDelivery),
      hasMore: raw.has_more,
      nextCursor: raw.next_cursor,
    }
  }
}
