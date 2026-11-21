import type { TemplateHeaderMediaFormat } from './template-components'
import type { TemplateMediaId } from './template-media-id'

/**
 * A file uploaded to be a template's header image, video or document. It is
 * not a `Media`: it lives in the templates domain, is complete the moment it
 * is created (no `status`, no `url`), and its `id` is only meaningful as the
 * reference a template's header carries.
 */
export interface TemplateMedia {
  readonly id: TemplateMediaId
  /** Which kind of header this file can be — derived by the API from the upload's `Content-Type`, never stated by the caller. */
  readonly format: TemplateHeaderMediaFormat
  readonly sizeBytes: number
  readonly contentType: string
  /** ISO 8601 timestamp. */
  readonly createdAt: string
}
