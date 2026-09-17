/** Parameters accepted by `webhooks.update()` — mirrors the real `PATCH /v1/webhook_endpoints/:id` body. */
export interface UpdateWebhookParams {
  /** Event types or wildcards, e.g. `"message.*"`. At least one is required. */
  readonly subscribedTypes: readonly string[]
}

interface UpdateWebhookRequestBody {
  subscribed_types: string[]
}

/** Converts `UpdateWebhookParams` into the real `PATCH /v1/webhook_endpoints/:id` request body. */
export function serializeUpdateWebhookParams(
  params: UpdateWebhookParams
): UpdateWebhookRequestBody {
  return {
    subscribed_types: [...params.subscribedTypes],
  }
}
