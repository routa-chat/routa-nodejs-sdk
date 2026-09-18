import { RoutaSignatureVerificationError } from '../domain/errors/routa-signature-verification-error'
import type { RoutaEvent } from '../event/event'
import { parseEvent, type RawEvent } from '../event/event-mapper'
import { verifySignature } from './signature-verifier'

/**
 * One signing secret, or several during a rotation overlap — every secret
 * passed is checked against every `v1=` value the header carries, so a
 * payload signed under either the active or the outgoing secret verifies.
 */
export type WebhookSigningSecret = string | readonly string[]

/**
 * Verifies a webhook delivery and returns its typed `RoutaEvent`.
 *
 * `rawBody` must be the exact bytes (or the exact string decoded from
 * those bytes) Routa sent, never a value that has been parsed and
 * re-serialized — the signature was computed over the literal bytes on the
 * wire, so re-encoding it (even just reordering object keys) produces a
 * different signature and fails verification.
 */
export async function constructEvent(
  rawBody: string | Uint8Array,
  signatureHeader: string | null,
  secret: WebhookSigningSecret
): Promise<RoutaEvent> {
  const secrets = typeof secret === 'string' ? [secret] : secret
  const bodyBytes =
    typeof rawBody === 'string' ? new TextEncoder().encode(rawBody) : rawBody

  const outcome = await verifySignature(
    signatureHeader,
    secrets,
    bodyBytes,
    new Date()
  )
  if (outcome !== 'valid') {
    throw new RoutaSignatureVerificationError(describeOutcome(outcome))
  }

  const bodyText =
    typeof rawBody === 'string' ? rawBody : new TextDecoder().decode(rawBody)

  let raw: RawEvent
  try {
    // Single point of parsing a webhook body into a typed value — the one
    // place an `as` is warranted, since a JSON payload has no static type
    // of its own. Safe to trust the shape here because the signature above
    // already proved this body came from Routa.
    raw = JSON.parse(bodyText) as RawEvent
  } catch {
    throw new RoutaSignatureVerificationError(
      'Webhook payload is not valid JSON.'
    )
  }

  return parseEvent(raw)
}

function describeOutcome(outcome: 'invalid' | 'expired' | 'malformed'): string {
  switch (outcome) {
    case 'invalid':
      return 'Webhook signature does not match the provided secret.'
    case 'expired':
      return 'Webhook signature timestamp is outside the allowed tolerance.'
    case 'malformed':
      return 'Webhook signature header is missing or malformed.'
    default: {
      const exhaustiveCheck: never = outcome
      return exhaustiveCheck
    }
  }
}
