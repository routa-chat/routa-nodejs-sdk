import type { RawMessage } from './message-mapper'

/** Filters accepted by `messages.list()` — mirrors the query params of `GET /v1/messages`. */
export interface ListMessagesParams {
  readonly direction?: 'inbound' | 'outbound'
  /** Max items per page (1-100). */
  readonly limit?: number
  readonly cursor?: string
}

/** Wire shape of a `GET /v1/messages` page, before its items are parsed into `Message`. */
export interface RawMessagePage {
  readonly data: readonly RawMessage[]
  readonly has_more: boolean
  readonly next_cursor: string | null
}
