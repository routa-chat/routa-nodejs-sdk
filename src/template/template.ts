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

/** Why a template was rejected — present only when `status` is `rejected`. */
export type TemplateRejectionReason =
  | 'abusive_content'
  | 'incorrect_category'
  | 'invalid_format'
  | 'scam'
  | 'tag_content_mismatch'
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
  readonly variables: readonly TemplateVariable[]
  readonly status: TemplateStatus
  readonly rejectionReason: TemplateRejectionReason | null
  readonly createdAt: string
  readonly updatedAt: string
}
