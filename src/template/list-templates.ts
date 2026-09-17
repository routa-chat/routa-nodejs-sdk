import type { RawTemplate } from './template-mapper'

/** Filters accepted by `templates.list()` — mirrors the query params of `GET /v1/templates`. */
export interface ListTemplatesParams {
  readonly channel?: string
  /** Max items per page (1-100). */
  readonly limit?: number
  readonly cursor?: string
}

/** Wire shape of a `GET /v1/templates` page, before its items are parsed into `Template`. */
export interface RawTemplatePage {
  readonly data: readonly RawTemplate[]
  readonly has_more: boolean
  readonly next_cursor: string | null
}
