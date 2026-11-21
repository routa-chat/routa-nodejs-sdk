import { readStringDetail } from './error-details'
import { RoutaApiError, type RoutaApiErrorDetails } from './routa-api-error'

/**
 * The request is valid but conflicts with the current state of the resource
 * (`409`, `type: 'conflict_error'`) — for example a template that cannot be
 * edited right now, or a project that cannot be deleted. Switch on `code`
 * for which one. `reason`, when the API sent one (`project_not_deletable`),
 * says what stands in the way.
 *
 * Retried by the SDK only for `idempotency_in_progress`, the one `409` that
 * means "try again shortly"; every other conflict is thrown at once.
 */
export class RoutaConflictError extends RoutaApiError {
  readonly reason: string | undefined

  constructor(message: string, details: RoutaApiErrorDetails) {
    super(message, details)
    this.name = 'RoutaConflictError'
    this.reason = readStringDetail(details.details, 'reason')
  }
}
