import type {
  Template,
  TemplateCategory,
  TemplateRejectionReason,
  TemplateStatus,
  TemplateVariable,
} from './template'
import { toTemplateId } from './template-id'

/** Wire shape of a template as returned by the API. */
export interface RawTemplate {
  readonly id: string
  readonly channel: string
  readonly name: string
  readonly language: string
  readonly category: TemplateCategory
  readonly variables: readonly TemplateVariable[]
  readonly status: TemplateStatus
  readonly rejection_reason: TemplateRejectionReason | null
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
    variables: raw.variables,
    status: raw.status,
    rejectionReason: raw.rejection_reason,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}
