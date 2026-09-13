const BACKOFF_BASE_MS = 500
const BACKOFF_CAP_MS = 8_000

/**
 * Decides whether a failed response is worth retrying, based only on the
 * status code and the machine-readable error code the server returned.
 *
 * Auth, not-found and validation failures (401/403/404/422) are excluded on
 * purpose — retrying a request the server has already rejected as invalid or
 * unauthorized just repeats the same failure. A `409` is retryable only when
 * it means "try again shortly" (an in-flight duplicate of the same write),
 * never when it means the same idempotency key was reused with a different
 * body — that is a client mistake retrying cannot fix.
 */
export function isRetryableFailure(
  status: number,
  code: string | undefined
): boolean {
  if (status === 409) {
    return code === 'idempotency_in_progress'
  }
  return status === 429 || status >= 500
}

/**
 * Computes how long to wait before the next attempt using "full jitter"
 * exponential backoff: a uniformly random delay between zero and an
 * exponentially growing cap. Spreading retries across that whole range,
 * rather than always waiting the maximum, avoids many clients retrying in
 * lockstep and overwhelming the server at the same instants.
 */
export function calculateBackoffDelayMs(
  attempt: number,
  random: () => number = Math.random
): number {
  const exponentialDelay = BACKOFF_BASE_MS * 2 ** attempt
  const cappedDelay = Math.min(BACKOFF_CAP_MS, exponentialDelay)
  return Math.floor(random() * cappedDelay)
}

/**
 * Parses a `Retry-After` header value into a millisecond delay. The header
 * is either a whole number of seconds or an HTTP date; anything else (header
 * absent or unparseable) yields `undefined` so the caller falls back to its
 * own backoff.
 */
export function parseRetryAfterMs(
  headerValue: string | null
): number | undefined {
  if (!headerValue) {
    return undefined
  }

  const seconds = Number(headerValue)
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000)
  }

  const dateMs = Date.parse(headerValue)
  if (Number.isNaN(dateMs)) {
    return undefined
  }
  return Math.max(0, dateMs - Date.now())
}
