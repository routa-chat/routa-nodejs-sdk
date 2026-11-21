import type { TemplateHeaderMediaFormat } from './template-components'
import type { TemplateMedia } from './template-media'
import { toTemplateMediaId } from './template-media-id'

/** Wire shape of a template media object as returned by `POST /v1/templates/media`. */
export interface RawTemplateMedia {
  readonly id: string
  readonly format: TemplateHeaderMediaFormat
  readonly size_bytes: number
  readonly content_type: string
  readonly created_at: string
}

/** Turns a raw API template media object into the typed `TemplateMedia`. */
export function parseTemplateMedia(raw: RawTemplateMedia): TemplateMedia {
  return {
    id: toTemplateMediaId(raw.id),
    format: raw.format,
    sizeBytes: raw.size_bytes,
    contentType: raw.content_type,
    createdAt: raw.created_at,
  }
}
