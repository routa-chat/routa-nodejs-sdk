/** Positional template send parameters — mirrors `template` in the real `POST /v1/messages` body. */
export interface SendMessageTemplateParams {
  readonly id: string
  /** Positional values for the template's `{{n}}` placeholders. */
  readonly bodyParameters?: readonly string[]
}

/**
 * Parameters accepted by `messages.send()`. `text` and `template` are
 * mutually exclusive at the type level — providing both is a compile error,
 * matching the real `POST /v1/messages` body (`{ channel, to, text?,
 * template?, metadata? }`), which supports only these two content shapes
 * today.
 */
export type SendMessageParams = {
  readonly channel: string
  /** Recipient address in E.164 format, e.g. `+5581999999999`. The leading `+` is optional — `5581999999999` is accepted too. */
  readonly to: string
  readonly metadata?: Record<string, string>
  /** Reused across every retry of this call instead of letting the SDK generate one. */
  readonly idempotencyKey?: string
} & (
  | { readonly text: string; readonly template?: never }
  | { readonly template: SendMessageTemplateParams; readonly text?: never }
)

interface SendMessageRequestBody {
  channel: string
  to: string
  text?: string
  template?: { id: string; body_parameters?: string[] }
  metadata?: Record<string, string>
}

/** Converts `SendMessageParams` into the real `POST /v1/messages` request body. */
export function serializeSendMessageParams(
  params: SendMessageParams
): SendMessageRequestBody {
  const body: SendMessageRequestBody = {
    channel: params.channel,
    to: params.to,
  }

  if ('text' in params) {
    body.text = params.text
  } else {
    body.template = {
      id: params.template.id,
      ...(params.template.bodyParameters !== undefined
        ? { body_parameters: [...params.template.bodyParameters] }
        : {}),
    }
  }

  if (params.metadata !== undefined) {
    body.metadata = params.metadata
  }

  return body
}
