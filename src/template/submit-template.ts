import type { TemplateCategory } from './template'
import type {
  TemplateButtonInput,
  TemplateComponentsInput,
  TemplateHeaderInput,
} from './template-components-input'

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
  /**
   * Header, footer and buttons. Leave it out for a body-only template. The SDK
   * checks the shape only; lengths, the number of buttons, URL and phone
   * formats and WhatsApp's own rules are the API's to judge (`422`).
   */
  readonly components?: TemplateComponentsInput
}

type SubmitTemplateRequestHeader =
  | { kind: 'text'; text: string }
  | { kind: 'media'; media_id: string }

type SubmitTemplateRequestButton =
  | { kind: 'quick_reply'; text: string }
  | { kind: 'phone_number'; text: string; phone_number: string }
  | { kind: 'url'; text: string; url: string }

interface SubmitTemplateRequestComponents {
  header?: SubmitTemplateRequestHeader
  footer?: { text: string }
  buttons?: SubmitTemplateRequestButton[]
}

interface SubmitTemplateRequestBody {
  channel: string
  name: string
  language: string
  category: TemplateCategory
  body_text: string
  components?: SubmitTemplateRequestComponents
}

function serializeHeader(
  header: TemplateHeaderInput
): SubmitTemplateRequestHeader {
  switch (header.kind) {
    case 'text':
      return { kind: 'text', text: header.text }
    case 'media':
      return { kind: 'media', media_id: header.mediaId }
  }
}

function serializeButton(
  button: TemplateButtonInput
): SubmitTemplateRequestButton {
  switch (button.kind) {
    case 'quick_reply':
      return { kind: 'quick_reply', text: button.text }
    case 'phone_number':
      return {
        kind: 'phone_number',
        text: button.text,
        phone_number: button.phoneNumber,
      }
    case 'url':
      return { kind: 'url', text: button.text, url: button.url }
  }
}

function serializeComponents(
  components: TemplateComponentsInput
): SubmitTemplateRequestComponents {
  return {
    ...(components.header !== undefined
      ? { header: serializeHeader(components.header) }
      : {}),
    ...(components.footer !== undefined
      ? { footer: { text: components.footer.text } }
      : {}),
    ...(components.buttons !== undefined
      ? { buttons: components.buttons.map(serializeButton) }
      : {}),
  }
}

/**
 * Converts `SubmitTemplateParams` into the real `POST /v1/templates` request
 * body. Without `components` the body has no `components` key at all.
 */
export function serializeSubmitTemplateParams(
  params: SubmitTemplateParams
): SubmitTemplateRequestBody {
  return {
    channel: params.channel,
    name: params.name,
    language: params.language,
    category: params.category,
    body_text: params.bodyText,
    ...(params.components !== undefined
      ? { components: serializeComponents(params.components) }
      : {}),
  }
}
