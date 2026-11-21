/**
 * Parameters accepted by `templates.uploadMedia()` — the bytes of a template
 * header file. Unlike `media.upload()` there is no `sourceUrl` mode:
 * `POST /v1/templates/media` only reads the bytes from the request body.
 */
export interface UploadTemplateMediaParams {
  /** The file itself. Sent as the request body, byte for byte — not wrapped in JSON or multipart. */
  readonly file: Blob | Uint8Array
  /**
   * What the bytes are: `image/jpeg`, `image/png`, `video/mp4` or
   * `application/pdf`. Sent as the request's `Content-Type`, which is how the
   * API learns the type (and derives the header's `format` from it): it is
   * **not** read from a `Blob`'s own `type`. The file's first bytes must match it.
   */
  readonly contentType: string
}
