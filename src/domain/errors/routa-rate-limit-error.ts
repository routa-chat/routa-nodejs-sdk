import { RoutaApiError, type RoutaApiErrorDetails } from './routa-api-error'

export interface RoutaRateLimitErrorDetails extends RoutaApiErrorDetails {
  readonly retryAfter: number | undefined
}

/**
 * The API is rate-limiting this request. `retryAfter`, when the server sent
 * one, is the number of seconds to wait before trying again.
 */
export class RoutaRateLimitError extends RoutaApiError {
  readonly retryAfter: number | undefined

  constructor(message: string, details: RoutaRateLimitErrorDetails) {
    super(message, details)
    this.name = 'RoutaRateLimitError'
    this.retryAfter = details.retryAfter
  }
}
