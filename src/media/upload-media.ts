/** Upload the bytes of a file yourself. */
export interface UploadMediaFileParams {
  /** The media itself. Sent as the request body, byte for byte — not wrapped in JSON or multipart. */
  readonly file: Blob | Uint8Array
  /**
   * What the bytes are, e.g. `image/png`. Sent as the request's `Content-Type`,
   * which is how the API learns the type: it is **not** read from a `Blob`'s own
   * `type`. It must be exactly one of the types the API accepts — no parameters
   * such as `; charset=…` — and the file's first bytes must match it.
   */
  readonly contentType: string
  readonly sourceUrl?: never
}

/** Have Routa download a public URL and re-host it. */
export interface UploadMediaUrlParams {
  /** A public `http` or `https` URL Routa fetches and stores. Sent as JSON `{ "source_url": … }`. */
  readonly sourceUrl: string
  readonly file?: never
  readonly contentType?: never
}

/**
 * Exactly one of two modes: `{ file, contentType }` to send bytes, or
 * `{ sourceUrl }` to have Routa fetch them. A union rather than optional
 * fields, so mixing the modes — or sending `file` without its `contentType` —
 * does not compile.
 */
export type UploadMediaParams = UploadMediaFileParams | UploadMediaUrlParams
