export interface RoutaApiErrorDetails {
  readonly code: string
  readonly requestId: string
  readonly docUrl: string | undefined
  readonly statusCode: number
}

/**
 * Base of every error the Routa API returns as an HTTP response. Carries the
 * fields every such error shares, so a caller can always report something
 * useful — a machine-readable `code`, the `requestId` that correlates this
 * failure with server-side logs, and the `statusCode` it came from — even
 * for a failure the SDK has no more specific subtype for.
 */
export class RoutaApiError extends Error {
  readonly code: string
  readonly requestId: string
  readonly docUrl: string | undefined
  readonly statusCode: number

  constructor(message: string, details: RoutaApiErrorDetails) {
    super(message)
    this.name = 'RoutaApiError'
    this.code = details.code
    this.requestId = details.requestId
    this.docUrl = details.docUrl
    this.statusCode = details.statusCode
  }
}
