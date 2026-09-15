import type { MediaId } from './media-id'

/**
 * Where a media object sits in processing: `pending` while Routa is still
 * fetching/validating it, `ready` once a signed `url` can be issued,
 * `unavailable` if it can no longer be served.
 */
export type MediaStatus = 'pending' | 'ready' | 'unavailable'

/** A media object stored by Routa, referenced by `media_id` elsewhere (e.g. an inbound message's `content`). */
export interface Media {
  readonly id: MediaId
  readonly contentType: string
  readonly status: MediaStatus
  /** A fresh signed URL, present only while `status` is `ready`. */
  readonly url: string | null
}
