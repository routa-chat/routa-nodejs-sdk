import type { Media, MediaStatus } from './media'
import { toMediaId } from './media-id'

/** Wire shape of a media object as returned by the API. */
export interface RawMedia {
  readonly id: string
  readonly content_type: string
  readonly status: MediaStatus
  readonly url: string | null
}

/** Turns a raw API media object into the typed `Media` every `media.*` method returns. */
export function parseMedia(raw: RawMedia): Media {
  return {
    id: toMediaId(raw.id),
    contentType: raw.content_type,
    status: raw.status,
    url: raw.url,
  }
}
