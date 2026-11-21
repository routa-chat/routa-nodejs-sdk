import { readNumberDetail, readStringDetail } from './error-details'
import { RoutaApiError, type RoutaApiErrorDetails } from './routa-api-error'

/**
 * The request was refused because of the organization's plan or payment
 * state (`402`, `type: 'billing_error'`). Never retried — retrying cannot
 * help until someone changes the plan or the payment method. Switch on
 * `code` to tell the cases apart:
 *
 * - `free_messages_exhausted` — `limit` and `used`.
 * - `message_quota_exceeded` — `limit`, `used` and `resetsAt`.
 * - `project_limit_exceeded`, `channel_limit_exceeded` — `limit` only.
 * - `subscription_required`, `payment_failed` — no numbers at all.
 *
 * The numbers are present only for the codes that define them, so each is
 * `undefined` otherwise. Test projects are never refused for billing.
 */
export class RoutaBillingError extends RoutaApiError {
  /** The allowance, or plan limit, that was reached. */
  readonly limit: number | undefined
  /** How much of `limit` was already used. */
  readonly used: number | undefined
  /** ISO 8601 moment the allowance resets — only for `message_quota_exceeded`. */
  readonly resetsAt: string | undefined

  constructor(message: string, details: RoutaApiErrorDetails) {
    super(message, details)
    this.name = 'RoutaBillingError'
    this.limit = readNumberDetail(details.details, 'limit')
    this.used = readNumberDetail(details.details, 'used')
    this.resetsAt = readStringDetail(details.details, 'resets_at')
  }
}
