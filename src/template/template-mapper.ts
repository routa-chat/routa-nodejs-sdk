import type {
  Template,
  TemplateCategory,
  TemplateFailureCode,
  TemplateOrigin,
  TemplateRejectionReason,
  TemplateStatus,
  TemplateUnsupportedComponent,
  TemplateVariable,
} from './template'
import {
  parseTemplateComponents,
  type RawTemplateComponents,
} from './template-components-mapper'
import { toTemplateId } from './template-id'

/** Wire shape of a template as returned by the API. */
export interface RawTemplate {
  readonly id: string
  readonly channel: string
  readonly name: string
  readonly language: string
  readonly category: TemplateCategory
  readonly body_text: string | null
  readonly variables: readonly TemplateVariable[]
  /** Absent for a body-only template — the API never sends an empty object. */
  readonly components?: RawTemplateComponents | undefined
  readonly status: TemplateStatus
  readonly rejection_reason: TemplateRejectionReason | null
  readonly failure_code: TemplateFailureCode | null
  readonly failure_detail: string | null
  readonly deletion_requested: boolean
  readonly deletion_failure_detail: string | null
  readonly origin: TemplateOrigin
  readonly read_only: boolean
  readonly unsupported_components: readonly TemplateUnsupportedComponent[]
  readonly created_at: string
  readonly updated_at: string
}

/** Turns a raw API template into the typed `Template` every `templates.*` method returns. */
export function parseTemplate(raw: RawTemplate): Template {
  return {
    id: toTemplateId(raw.id),
    channel: raw.channel,
    name: raw.name,
    language: raw.language,
    category: raw.category,
    bodyText: raw.body_text,
    variables: raw.variables,
    ...(raw.components !== undefined
      ? { components: parseTemplateComponents(raw.components) }
      : {}),
    status: raw.status,
    rejectionReason: raw.rejection_reason,
    failureCode: raw.failure_code,
    failureDetail: raw.failure_detail,
    deletionRequested: raw.deletion_requested,
    deletionFailureDetail: raw.deletion_failure_detail,
    origin: raw.origin,
    readOnly: raw.read_only,
    unsupportedComponents: raw.unsupported_components,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}
