import {
  RoutaApiError,
  type RoutaApiErrorDetails,
} from '../domain/errors/routa-api-error'
import { RoutaAuthenticationError } from '../domain/errors/routa-authentication-error'
import { RoutaInvalidRequestError } from '../domain/errors/routa-invalid-request-error'
import { RoutaRateLimitError } from '../domain/errors/routa-rate-limit-error'

/**
 * The fields of a failed Routa API response relevant to building an error —
 * already extracted from the response body and headers by the caller.
 * `requestId` is passed separately to `mapErrorResponse` rather than read
 * from here because it comes from a response header present on every
 * response (success or failure), not from the body.
 */
export interface ErrorEnvelope {
  readonly code?: string
  readonly message?: string
  readonly param?: string
  readonly docUrl?: string
  /** Seconds to wait before retrying, parsed from a `Retry-After` header. */
  readonly retryAfter?: number
}

const DEFAULT_MESSAGE_PREFIX = 'Routa API request failed'
const UNKNOWN_ERROR_CODE = 'unknown_error'

/**
 * Every HTTP status this SDK has a specific error subclass for, keyed with
 * `satisfies` so the literal statuses stay available to `isMappedStatus`
 * below instead of widening to `number`. A status outside this table (a
 * `409` conflict, a `5xx` infrastructure failure, or anything undocumented)
 * falls back to the base `RoutaApiError` — this table never guesses a more
 * specific subtype than the response gives evidence for.
 */
const ERROR_CLASS_BY_STATUS = {
  401: RoutaAuthenticationError,
  403: RoutaInvalidRequestError,
  404: RoutaInvalidRequestError,
  422: RoutaInvalidRequestError,
  429: RoutaRateLimitError,
} satisfies Record<number, typeof RoutaApiError>

type MappedStatus = keyof typeof ERROR_CLASS_BY_STATUS

function isMappedStatus(status: number): status is MappedStatus {
  return status in ERROR_CLASS_BY_STATUS
}

/**
 * Translates a failed HTTP response into the right `RoutaApiError` subtype.
 * This is the one place that knows how a status code becomes a specific
 * error class — every other module only needs to know that a
 * `RoutaApiError` (or one of its documented subtypes) can be thrown.
 */
export function mapErrorResponse(
  status: number,
  envelope: ErrorEnvelope,
  requestId: string
): RoutaApiError {
  const message = envelope.message ?? `${DEFAULT_MESSAGE_PREFIX} (${status}).`
  const details: RoutaApiErrorDetails = {
    code: envelope.code ?? UNKNOWN_ERROR_CODE,
    requestId,
    docUrl: envelope.docUrl,
    statusCode: status,
  }

  if (!isMappedStatus(status)) {
    return new RoutaApiError(message, details)
  }

  switch (status) {
    case 401:
      return new RoutaAuthenticationError(message, details)
    case 403:
    case 404:
    case 422:
      return new RoutaInvalidRequestError(message, {
        ...details,
        param: envelope.param,
      })
    case 429:
      return new RoutaRateLimitError(message, {
        ...details,
        retryAfter: envelope.retryAfter,
      })
    default: {
      const exhaustiveCheck: never = status
      throw new Error(`Unmapped Routa error status: ${exhaustiveCheck}`)
    }
  }
}
