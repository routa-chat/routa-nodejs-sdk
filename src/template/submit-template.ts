import type { TemplateCategory } from './template'

/** Parameters accepted by `templates.submit()` — mirrors the real `POST /v1/templates` body. */
export interface SubmitTemplateParams {
  /** The channel id this template belongs to. */
  readonly channel: string
  readonly name: string
  /** BCP-47 language code, e.g. `en_US`. */
  readonly language: string
  readonly category: TemplateCategory
  /** The body to submit for approval, with `{{1}}`, `{{2}}`, … positional placeholders. */
  readonly bodyText: string
}

interface SubmitTemplateRequestBody {
  channel: string
  name: string
  language: string
  category: TemplateCategory
  body_text: string
}

/** Converts `SubmitTemplateParams` into the real `POST /v1/templates` request body. */
export function serializeSubmitTemplateParams(
  params: SubmitTemplateParams
): SubmitTemplateRequestBody {
  return {
    channel: params.channel,
    name: params.name,
    language: params.language,
    category: params.category,
    body_text: params.bodyText,
  }
}
