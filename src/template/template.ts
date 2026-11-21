import type { TemplateComponents } from './template-components'
import type { TemplateId } from './template-id'

/** The Meta-defined purpose a template is submitted under. */
export type TemplateCategory = 'marketing' | 'utility' | 'authentication'

/** Where a template sits in the provider's review lifecycle. */
export type TemplateStatus =
  | 'draft'
  | 'submitted'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'paused'
  | 'disabled'
  | 'failed'

/** Why a template was rejected — present only when `status` is `rejected`. */
export type TemplateRejectionReason =
  | 'abusive_content'
  | 'incorrect_category'
  | 'invalid_format'
  | 'scam'
  | 'tag_content_mismatch'
  | 'other'

/**
 * Why Routa could not submit a template — present only when `status` is
 * `failed`. A closed list of Routa's own words; for the provider's own
 * sentence, if it gave one, read `Template.failureDetail`.
 */
export type TemplateFailureCode =
  | 'attempts_exhausted'
  | 'channel_unavailable'
  | 'media_unavailable'
  | 'provider_auth_failed'
  | 'provider_rejected_request'
  | 'provider_unavailable'

/**
 * Where a template came from: `routa` was submitted through Routa,
 * `provider` already existed on WhatsApp and was imported.
 */
export type TemplateOrigin = 'routa' | 'provider'

/**
 * What Routa could not model of an imported template — the reason a template
 * is `readOnly`. A closed list of Routa's own words, never the provider's.
 */
export type TemplateUnsupportedComponent =
  | 'carousel'
  | 'catalog'
  | 'copy_code_button'
  | 'flow_button'
  | 'limited_time_offer'
  | 'location_header'
  | 'media_header'
  | 'named_parameters'
  | 'otp_button'
  | 'other'

/** A positional `{{n}}` placeholder in a template's body. */
export interface TemplateVariable {
  readonly index: number
}

/** A reusable, provider-approved message template. */
export interface Template {
  readonly id: TemplateId
  readonly channel: string
  readonly name: string
  readonly language: string
  readonly category: TemplateCategory
  /**
   * The body as written, `{{1}}`, `{{2}}`, … included. `null` only for an
   * imported template Routa cannot reproduce (`readOnly`), which has no body
   * to show.
   */
  readonly bodyText: string | null
  readonly variables: readonly TemplateVariable[]
  /**
   * Header, footer and buttons. Absent — not an empty object — for a
   * body-only template.
   */
  readonly components?: TemplateComponents
  readonly status: TemplateStatus
  readonly rejectionReason: TemplateRejectionReason | null
  /** Why submission failed — non-`null` only while `status` is `failed`. */
  readonly failureCode: TemplateFailureCode | null
  /**
   * The provider's own short sentence about a refusal, when it gave one —
   * only while `status` is `failed`. Text for a person, often in the
   * account's language: never match on it, use `failureCode`.
   */
  readonly failureDetail: string | null
  /**
   * `true` from the moment a deletion was accepted for a template WhatsApp
   * holds until it is gone: the template can no longer be sent or edited.
   */
  readonly deletionRequested: boolean
  /**
   * Why the last deletion ended without deleting the template, in the
   * provider's own words when it gave any. Informational — never match on
   * it. `null` when no deletion failed.
   */
  readonly deletionFailureDetail: string | null
  /**
   * `routa` for a template submitted through Routa; `provider` for one that
   * already existed on WhatsApp and was imported. See `readOnly`.
   */
  readonly origin: TemplateOrigin
  /**
   * `true` for an imported template (`origin: 'provider'`) Routa cannot
   * reproduce: it is listed so it is not missing, but this SDK cannot edit it
   * and a message that names it is refused with `422 template_not_sendable`.
   * Always `false` for `origin: 'routa'`. `unsupportedComponents` says why.
   */
  readonly readOnly: boolean
  /** Why the template is `readOnly`; empty otherwise. */
  readonly unsupportedComponents: readonly TemplateUnsupportedComponent[]
  readonly createdAt: string
  readonly updatedAt: string
}
