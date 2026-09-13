/**
 * Generates a key for one write call, to be sent as `Idempotency-Key`.
 *
 * Call this once per logical operation, before the first attempt — every
 * retry of that same call must reuse the exact key this returns, otherwise
 * the replay protection retries exist to provide is lost (a retried write
 * would look like a brand-new one to the server).
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID()
}
