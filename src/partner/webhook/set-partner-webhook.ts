import type { Webhook } from '../../webhook/webhook'

/** Parameters accepted by `webhook.set()` — mirrors the `PUT /v1/partner/webhook` body. */
export interface SetPartnerWebhookParams {
  /** https:// endpoint that receives the events of every project of the organization, each carrying its `project_id` and `external_ref`. */
  readonly url: string
  /** Event types or wildcards, e.g. `"message.*"`. At least one is required. */
  readonly subscribedTypes: readonly string[]
}

/** What `webhook.set()` returns. */
export interface PartnerWebhookSetResult {
  readonly webhook: Webhook
  /**
   * The signing secret — present only when this call **created** the
   * webhook (`201`), and shown once. Absent when it replaced an existing one
   * (`200`): the secret it already has is unchanged.
   */
  readonly secret?: string
}

interface SetPartnerWebhookRequestBody {
  url: string
  subscribed_types: string[]
}

export function serializeSetPartnerWebhookParams(
  params: SetPartnerWebhookParams
): SetPartnerWebhookRequestBody {
  return {
    url: params.url,
    subscribed_types: [...params.subscribedTypes],
  }
}
