import { hmacSha256Hex } from '../crypto/hmac-sha256-hex'

/** How far a signed timestamp may drift from "now" before it is rejected. */
export const SIGNATURE_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000

/** `HMAC-SHA256(secret, "{timestamp}." + rawBody)`, as lowercase hex. */
export async function computeSignature(
  secret: string,
  timestampSeconds: number,
  rawBody: Uint8Array
): Promise<string> {
  const prefix = new TextEncoder().encode(`${timestampSeconds}.`)
  const message = new Uint8Array(prefix.length + rawBody.length)
  message.set(prefix, 0)
  message.set(rawBody, prefix.length)
  return hmacSha256Hex(secret, message)
}

/** `t=…,v1=…` — one `v1=` per secret, so a rotation overlap needs no special casing on the receiving end. */
export async function buildSignatureHeader(
  secrets: readonly string[],
  timestampSeconds: number,
  rawBody: Uint8Array
): Promise<string> {
  const signatures = await Promise.all(
    secrets.map(
      async secret =>
        `v1=${await computeSignature(secret, timestampSeconds, rawBody)}`
    )
  )
  return `t=${timestampSeconds},${signatures.join(',')}`
}

export interface ParsedSignatureHeader {
  readonly timestampSeconds: number
  readonly signatures: readonly string[]
}

/** Tolerant of any number of `v1=` values in any order — the shape a header carries during secret rotation. */
export function parseSignatureHeader(
  header: string
): ParsedSignatureHeader | null {
  let timestampSeconds: number | null = null
  const signatures: string[] = []

  for (const rawPart of header.split(',')) {
    const part = rawPart.trim()
    const separatorIndex = part.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }
    const key = part.slice(0, separatorIndex)
    const value = part.slice(separatorIndex + 1)
    if (key === 't') {
      timestampSeconds = Number.parseInt(value, 10)
    } else if (key === 'v1' && value) {
      signatures.push(value)
    }
  }

  if (
    timestampSeconds === null ||
    Number.isNaN(timestampSeconds) ||
    signatures.length === 0
  ) {
    return null
  }
  return { timestampSeconds, signatures }
}

/** `null` for an odd-length or non-hex string, rather than throwing — malformed input is a normal, expected case here. */
function fromHex(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    return null
  }
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Compares two byte strings in time proportional only to their length, never
 * to where the first difference falls — an early `return false` on mismatch
 * would let an attacker recover the correct signature one byte at a time by
 * timing repeated guesses.
 */
function constantTimeHexEquals(a: string, b: string): boolean {
  const bytesA = fromHex(a)
  const bytesB = fromHex(b)
  if (bytesA === null || bytesB === null || bytesA.length !== bytesB.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < bytesA.length; i++) {
    const byteA = bytesA[i]
    const byteB = bytesB[i]
    if (byteA === undefined || byteB === undefined) {
      return false
    }
    diff |= byteA ^ byteB
  }
  return diff === 0
}

export type SignatureVerificationOutcome =
  | 'valid'
  | 'invalid'
  | 'expired'
  | 'malformed'

/**
 * Verifies a `Routa-Signature`-style header against one or more candidate
 * secrets, so a caller mid-rotation can pass both the active and the
 * previous secret without special-casing which one actually signed the
 * payload.
 */
export async function verifySignature(
  header: string | null,
  secrets: readonly string[],
  rawBody: Uint8Array,
  now: Date,
  toleranceMs: number = SIGNATURE_TIMESTAMP_TOLERANCE_MS
): Promise<SignatureVerificationOutcome> {
  if (!header) {
    return 'malformed'
  }
  const parsed = parseSignatureHeader(header)
  if (!parsed) {
    return 'malformed'
  }
  if (Math.abs(now.getTime() - parsed.timestampSeconds * 1000) > toleranceMs) {
    return 'expired'
  }

  for (const secret of secrets) {
    const expected = await computeSignature(
      secret,
      parsed.timestampSeconds,
      rawBody
    )
    for (const signature of parsed.signatures) {
      if (constantTimeHexEquals(signature, expected)) {
        return 'valid'
      }
    }
  }
  return 'invalid'
}
