/**
 * A webhook payload failed signature verification — the signature was
 * missing, malformed, expired, or did not match any configured secret.
 *
 * Unlike the rest of this taxonomy, this is never constructed from an HTTP
 * response: verification runs locally over bytes the caller already
 * received, so there is no `requestId` or `statusCode` to attach.
 */
export class RoutaSignatureVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RoutaSignatureVerificationError'
  }
}
