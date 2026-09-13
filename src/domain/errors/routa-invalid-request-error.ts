import { RoutaApiError, type RoutaApiErrorDetails } from './routa-api-error'

export interface RoutaInvalidRequestErrorDetails extends RoutaApiErrorDetails {
  readonly param: string | undefined
}

/**
 * The request itself was rejected — invalid input, a referenced resource
 * that does not exist, or a scope the API key does not have. `param`, when
 * the server named one, is the specific request field the rejection is
 * about.
 */
export class RoutaInvalidRequestError extends RoutaApiError {
  readonly param: string | undefined

  constructor(message: string, details: RoutaInvalidRequestErrorDetails) {
    super(message, details)
    this.name = 'RoutaInvalidRequestError'
    this.param = details.param
  }
}
