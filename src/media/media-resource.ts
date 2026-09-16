import type { HttpClient } from '../http/http-client'
import type { Media } from './media'
import type { MediaId } from './media-id'
import { parseMedia, type RawMedia } from './media-mapper'

/**
 * `routa.media.*` — read access to media objects. Orchestrates `http` — no
 * transport logic of its own.
 *
 * `upload()` is intentionally not implemented: the real API's request body
 * for that operation is not published anywhere this SDK can verify it
 * against, and guessing a request shape risks shipping a method that looks
 * correct but fails or silently misbehaves against the real server.
 */
export class MediaResource {
  constructor(private readonly http: HttpClient) {}

  async retrieve(id: MediaId): Promise<Media> {
    const raw = await this.http.request<RawMedia>({
      method: 'GET',
      path: `/v1/media/${id}`,
    })
    return parseMedia(raw)
  }
}
