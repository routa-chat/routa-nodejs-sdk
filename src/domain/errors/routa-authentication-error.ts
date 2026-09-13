import { RoutaApiError, type RoutaApiErrorDetails } from './routa-api-error'

/**
 * The API key is missing, invalid, expired, or otherwise cannot
 * authenticate the request. Retrying without changing the credential will
 * never succeed.
 */
export class RoutaAuthenticationError extends RoutaApiError {
  constructor(message: string, details: RoutaApiErrorDetails) {
    super(message, details)
    this.name = 'RoutaAuthenticationError'
  }
}
