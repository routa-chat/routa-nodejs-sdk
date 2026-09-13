import { RoutaApiError, type RoutaApiErrorDetails } from './routa-api-error'

/**
 * The messaging provider (e.g. WhatsApp) rejected or could not deliver a
 * message. Reserved for when a provider outcome can be reported this way —
 * as of this SDK version, provider outcomes are only observable
 * asynchronously (a `message.failed` event), never as a direct response to
 * a send call, so nothing in the SDK constructs this error yet.
 */
export class RoutaProviderError extends RoutaApiError {
  constructor(message: string, details: RoutaApiErrorDetails) {
    super(message, details)
    this.name = 'RoutaProviderError'
  }
}
