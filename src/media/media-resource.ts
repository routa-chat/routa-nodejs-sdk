import type { HttpClient } from '../http/http-client'
import type { Media } from './media'
import type { MediaId } from './media-id'
import { parseMedia, type RawMedia } from './media-mapper'
import type { UploadMediaParams } from './upload-media'

/**
 * `routa.media.*` — upload and read media objects. Orchestrates `http` — no
 * transport logic of its own.
 */
export class MediaResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Stores a media file in Routa and returns its `Media` (`POST /v1/media`,
   * API key scope `media:write`). Two modes — see `UploadMediaParams`:
   *
   * ```ts
   * await routa.media.upload({ file: bytes, contentType: 'image/png' })
   * await routa.media.upload({ sourceUrl: 'https://example.com/photo.png' })
   * ```
   *
   * The upload is synchronous: on success the `Media` is already `ready` and
   * carries a signed `url`, valid for 15 minutes — `retrieve()` issues a fresh
   * one. Keep the `id`; `messages.send()` does not accept media yet, so nothing
   * in this SDK consumes it.
   *
   * **No client-side checks.** The SDK validates neither the size nor the type
   * of `file` — the API is the source of truth, and a rule copied here would
   * drift from it. A rejected upload throws:
   *
   * - `RoutaInvalidRequestError` (`422`) with one of these `code`s (none sets
   *   `param`):
   *   - `media_content_type_rejected` — `contentType` is not a supported type,
   *     or the file's first bytes do not match it (a PNG declared as `image/jpeg`).
   *   - `media_size_limit_exceeded` — the file is over its type's cap.
   *   - `media_source_url_invalid` — `sourceUrl` is empty or not a usable URL.
   *   - `media_source_blocked` — `sourceUrl` points somewhere Routa refuses to
   *     fetch from (a private network address, for instance).
   *   - `media_source_unreachable` — Routa could not download `sourceUrl`.
   * - `RoutaApiError` (a base one — there is no subclass for these) with
   *   `statusCode` `413` and `code` `payload_too_large`, when the declared body
   *   exceeds the endpoint's ceiling (100 MiB for bytes). `411 length_required`
   *   is declared by the API for chunked bodies but cannot come from this
   *   method: `fetch` sends a `Content-Length` for a `Uint8Array` or `Blob`.
   *   Neither is retried.
   * - `RoutaInvalidRequestError` `403 insufficient_scope` if the key lacks
   *   `media:write`.
   *
   * Limits, as the reference API enforces them (`packages/messaging`'s
   * `media-content-type.ts`): `image/jpeg` and `image/png` 5 MiB, `image/webp`
   * 500 KiB, `video/mp4` and `video/3gpp` 16 MiB, `audio/aac`, `audio/mp4`,
   * `audio/mpeg`, `audio/amr` and `audio/ogg` 16 MiB, and 100 MiB for `application/pdf`,
   * Word, Excel and PowerPoint documents (legacy and OOXML) and `text/plain`. The
   * `contentType` is matched exactly, so `image/png; charset=binary` is rejected.
   * Do not pass `application/json` as `contentType`: the API reads that as
   * the `sourceUrl` mode and answers `media_source_url_invalid`.
   *
   * **Not idempotent.** `POST /v1/media` does not read `Idempotency-Key`, so
   * the SDK sends none. The client still retries a network failure or a `5xx`
   * up to `maxRetries` times (as it does for every request); if the first
   * attempt had already stored the file and only the response was lost, the retry
   * stores a second copy under a new `id`. Set `maxRetries: 0` on the client if
   * a duplicate matters more than resilience to a flaky connection.
   */
  async upload(params: UploadMediaParams): Promise<Media> {
    const raw =
      params.file !== undefined
        ? await this.http.request<RawMedia>({
            method: 'POST',
            path: '/v1/media',
            rawBody: { data: params.file, contentType: params.contentType },
          })
        : await this.http.request<RawMedia>({
            method: 'POST',
            path: '/v1/media',
            body: { source_url: params.sourceUrl },
          })
    return parseMedia(raw)
  }

  async retrieve(id: MediaId): Promise<Media> {
    const raw = await this.http.request<RawMedia>({
      method: 'GET',
      path: `/v1/media/${id}`,
    })
    return parseMedia(raw)
  }
}
