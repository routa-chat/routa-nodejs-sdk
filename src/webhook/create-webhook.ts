/** Parameters accepted by `webhooks.create()` — mirrors the real `POST /v1/webhook_endpoints` body. */
export interface CreateWebhookParams {
  /** https:// endpoint to deliver events to. */
  readonly url: string
  /** Event types or wildcards, e.g. `"message.*"`. At least one is required. */
  readonly subscribedTypes: readonly string[]
}

interface CreateWebhookRequestBody {
  url: string
  subscribed_types: string[]
}

/** Converts `CreateWebhookParams` into the real `POST /v1/webhook_endpoints` request body. */
export function serializeCreateWebhookParams(
  params: CreateWebhookParams
): CreateWebhookRequestBody {
  return {
    url: params.url,
    subscribed_types: [...params.subscribedTypes],
  }
}
