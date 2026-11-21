import type { RoutaErrorDetailValues } from './error-details'

export interface RoutaApiErrorDetails {
  readonly code: string
  readonly requestId: string
  readonly docUrl: string | undefined
  readonly statusCode: number
  /** The API's own error category, e.g. `billing_error`; absent from a response that did not come from the API (a proxy's). */
  readonly type?: string | undefined
  /** The `error.details` of the response; absent when the error defines none. */
  readonly details?: RoutaErrorDetailValues | undefined
}

/**
 * Base of every error the Routa API returns as an HTTP response. Carries the
 * fields every such error shares, so a caller can always report something
 * useful — a machine-readable `code`, the `requestId` that correlates this
 * failure with server-side logs, and the `statusCode` it came from — even
 * for a failure the SDK has no more specific subtype for. `type` is the
 * API's error category (`billing_error`, `conflict_error`, …) and `details`
 * the machine-readable values some errors carry; both are `undefined` when
 * the response did not include them. The subclasses expose the `details`
 * they document as typed fields.
 */
export class RoutaApiError extends Error {
  readonly code: string
  readonly requestId: string
  readonly docUrl: string | undefined
  readonly statusCode: number
  readonly type: string | undefined
  readonly details: RoutaErrorDetailValues | undefined

  constructor(message: string, details: RoutaApiErrorDetails) {
    super(message)
    this.name = 'RoutaApiError'
    this.code = details.code
    this.requestId = details.requestId
    this.docUrl = details.docUrl
    this.statusCode = details.statusCode
    this.type = details.type
    this.details = details.details
  }
}
