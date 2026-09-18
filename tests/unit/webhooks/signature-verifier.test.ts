import { describe, expect, it } from 'vitest'
import {
  buildSignatureHeader,
  computeSignature,
  verifySignature,
} from '../../../src/webhooks/signature-verifier'

const SECRET_A = 'whsec_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SECRET_B = 'whsec_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function bytes(body: string): Uint8Array {
  return new TextEncoder().encode(body)
}

describe('verifySignature', () => {
  it('accepts a signature computed over the exact raw body', async () => {
    const now = new Date('2026-09-04T00:00:00Z')
    const timestampSeconds = Math.floor(now.getTime() / 1000)
    const body = bytes(JSON.stringify({ id: 'evt_1', type: 'message.sent' }))
    const header = await buildSignatureHeader(
      [SECRET_A],
      timestampSeconds,
      body
    )

    expect(await verifySignature(header, [SECRET_A], body, now)).toBe('valid')
  })

  it('rejects a tampered body signed under a different payload', async () => {
    const now = new Date('2026-09-04T00:00:00Z')
    const timestampSeconds = Math.floor(now.getTime() / 1000)
    const originalBody = bytes(JSON.stringify({ amount: 100 }))
    const tamperedBody = bytes(JSON.stringify({ amount: 100000 }))
    const header = await buildSignatureHeader(
      [SECRET_A],
      timestampSeconds,
      originalBody
    )

    expect(await verifySignature(header, [SECRET_A], tamperedBody, now)).toBe(
      'invalid'
    )
  })

  it('rejects a timestamp outside the 5-minute tolerance', async () => {
    const signedAt = new Date('2026-09-04T00:00:00Z')
    const verifiedAt = new Date('2026-09-04T00:06:00Z')
    const body = bytes('{}')
    const header = await buildSignatureHeader(
      [SECRET_A],
      Math.floor(signedAt.getTime() / 1000),
      body
    )

    expect(await verifySignature(header, [SECRET_A], body, verifiedAt)).toBe(
      'expired'
    )
  })

  it('accepts a signature under either secret during rotation overlap', async () => {
    const now = new Date('2026-09-04T00:00:00Z')
    const timestampSeconds = Math.floor(now.getTime() / 1000)
    const body = bytes('{"rotating":true}')

    // Signed only with the old (previous) secret, verified against both.
    const header = await buildSignatureHeader(
      [SECRET_B],
      timestampSeconds,
      body
    )
    expect(await verifySignature(header, [SECRET_A, SECRET_B], body, now)).toBe(
      'valid'
    )

    // The header itself may carry a `v1=` for every active secret at once.
    const bothHeader = await buildSignatureHeader(
      [SECRET_A, SECRET_B],
      timestampSeconds,
      body
    )
    expect(
      bothHeader.split(',').filter(part => part.startsWith('v1='))
    ).toHaveLength(2)
    expect(await verifySignature(bothHeader, [SECRET_A], body, now)).toBe(
      'valid'
    )
    expect(await verifySignature(bothHeader, [SECRET_B], body, now)).toBe(
      'valid'
    )
  })

  it('rejects when signed against a re-serialized body instead of the raw bytes (the raw-body trap)', async () => {
    const now = new Date('2026-09-04T00:00:00Z')
    const timestampSeconds = Math.floor(now.getTime() / 1000)
    const originalObject = { b: 2, a: 1 }
    // The raw bytes actually sent over the wire, key order as constructed.
    const rawBodySent = bytes(JSON.stringify(originalObject))
    // A verifier that re-serializes the parsed object (e.g. different key
    // order, or reformatted whitespace) signs something byte-different.
    const reserialized = bytes(
      JSON.stringify(
        JSON.parse(new TextDecoder().decode(rawBodySent)),
        Object.keys(originalObject).sort()
      )
    )

    const header = await computeSignatureHeaderOverRawBytes(
      SECRET_A,
      timestampSeconds,
      rawBodySent
    )

    expect(await verifySignature(header, [SECRET_A], reserialized, now)).toBe(
      'invalid'
    )
    expect(await verifySignature(header, [SECRET_A], rawBodySent, now)).toBe(
      'valid'
    )
  })

  it('returns malformed for a missing or unparseable header', async () => {
    const body = bytes('{}')
    expect(await verifySignature(null, [SECRET_A], body, new Date())).toBe(
      'malformed'
    )
    expect(
      await verifySignature('not-a-signature', [SECRET_A], body, new Date())
    ).toBe('malformed')
  })
})

async function computeSignatureHeaderOverRawBytes(
  secret: string,
  timestampSeconds: number,
  rawBody: Uint8Array
): Promise<string> {
  return `t=${timestampSeconds},v1=${await computeSignature(secret, timestampSeconds, rawBody)}`
}
