import type { EventType } from './event'
import type { RawEvent } from './event-mapper'

/** Filters accepted by `events.list()` — mirrors the query params of `GET /v1/events`. */
export interface ListEventsParams {
  readonly type?: EventType
  /** Resume after this event id. */
  readonly after?: string
  /** Max items per page (1-100). */
  readonly limit?: number
}

/** Wire shape of a `GET /v1/events` page, before its items are parsed into `RoutaEvent`. */
export interface RawEventPage {
  readonly data: readonly RawEvent[]
  readonly has_more: boolean
  readonly next_cursor: string | null
}
