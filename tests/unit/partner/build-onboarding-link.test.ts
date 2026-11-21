import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildOnboardingLink } from '../../../src/partner'

/**
 * The test vectors of the backend's partner onboarding guide
 * (`docs/guides/partner-onboarding.md`, "Test vectors"). The guide computes
 * them with Node's `createHmac` over the strings below, outside Routa's own
 * code — so passing them proves this SDK reproduces the canonical string
 * byte for byte.
 */
const SECRET = 'rt_psign_TESTVECTORSECRET0000000000000000000000'
const PARTNER_ID = 'ptn_TestPartner0000000000'
const TS = 1790000000
const NOW = new Date(TS * 1000)

const MINIMAL_CANONICAL = [
  'routa-partner-link-v1',
  'external_ref=lead_123',
  'partner_id=ptn_TestPartner0000000000',
  'ts=1790000000',
].join('\n')
const MINIMAL_SIGNATURE =
  '0676f9f5ee8e76eff763defdac73798afd0b7cf165abb875356ef4f370ff524a'

const FULL_CANONICAL = [
  'routa-partner-link-v1',
  'external_ref=lead_123',
  'name=Acme Ltda',
  'partner_id=ptn_TestPartner0000000000',
  'redirect_url=https://partner.example/connected?x=1',
  'state=opaque:state/42',
  'ts=1790000000',
].join('\n')
const FULL_SIGNATURE =
  'ff77d689a13e1057dda3b87e9f3f4e0788a98568d3022794ea6ecfc7c6dbb90c'

function hmac(canonical: string): string {
  return createHmac('sha256', SECRET).update(canonical).digest('hex')
}

const base = {
  partnerId: PARTNER_ID,
  signingSecret: SECRET,
  externalRef: 'lead_123',
  now: NOW,
}

afterEach(() => {
  vi.useRealTimers()
})

describe('buildOnboardingLink() — the backend test vectors', () => {
  it('the vectors themselves hold (guards against a typo in this file)', () => {
    expect(hmac(MINIMAL_CANONICAL)).toBe(MINIMAL_SIGNATURE)
    expect(hmac(FULL_CANONICAL)).toBe(FULL_SIGNATURE)
  })

  it('reproduces the minimal vector', async () => {
    const link = new URL(await buildOnboardingLink(base))

    expect(link.searchParams.get('signature')).toBe(MINIMAL_SIGNATURE)
  })

  it('reproduces the full vector', async () => {
    const link = new URL(
      await buildOnboardingLink({
        ...base,
        name: 'Acme Ltda',
        redirectUrl: 'https://partner.example/connected?x=1',
        state: 'opaque:state/42',
      })
    )

    expect(link.searchParams.get('signature')).toBe(FULL_SIGNATURE)
  })

  it('signs the same bytes whatever order the optional fields were given in', async () => {
    const one = await buildOnboardingLink({
      ...base,
      state: 'opaque:state/42',
      name: 'Acme Ltda',
      redirectUrl: 'https://partner.example/connected?x=1',
    })
    expect(new URL(one).searchParams.get('signature')).toBe(FULL_SIGNATURE)
  })

  it('signs the non-ASCII bytes of a name as UTF-8, the decoded value', async () => {
    const name = 'Loja do Zé — açaí'
    const canonical = [
      'routa-partner-link-v1',
      'external_ref=lead_123',
      `name=${name}`,
      'partner_id=ptn_TestPartner0000000000',
      'ts=1790000000',
    ].join('\n')

    const link = new URL(await buildOnboardingLink({ ...base, name }))

    expect(link.searchParams.get('signature')).toBe(hmac(canonical))
    expect(link.searchParams.get('name')).toBe(name)
  })
})

describe('buildOnboardingLink() — the link', () => {
  it('is https://app.routa.chat/connect/{partnerId} with exactly the documented parameters', async () => {
    const link = new URL(
      await buildOnboardingLink({
        ...base,
        name: 'Acme Ltda',
        redirectUrl: 'https://partner.example/connected?x=1',
        state: 'opaque:state/42',
      })
    )

    expect(link.origin).toBe('https://app.routa.chat')
    expect(link.pathname).toBe(`/connect/${PARTNER_ID}`)
    expect(Object.fromEntries(link.searchParams)).toEqual({
      external_ref: 'lead_123',
      name: 'Acme Ltda',
      partner_id: PARTNER_ID,
      redirect_url: 'https://partner.example/connected?x=1',
      state: 'opaque:state/42',
      ts: '1790000000',
      signature: FULL_SIGNATURE,
    })
  })

  it('carries only the required parameters when no optional one is given', async () => {
    const link = new URL(await buildOnboardingLink(base))

    expect([...link.searchParams.keys()].sort()).toEqual([
      'external_ref',
      'partner_id',
      'signature',
      'ts',
    ])
  })

  it('signature is 64 lowercase hex characters', async () => {
    const link = new URL(await buildOnboardingLink(base))

    expect(link.searchParams.get('signature')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('takes ts from the clock in Unix seconds when now is not given', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-21T12:00:00.900Z'))

    const link = new URL(
      await buildOnboardingLink({
        partnerId: PARTNER_ID,
        signingSecret: SECRET,
        externalRef: 'lead_123',
      })
    )

    expect(link.searchParams.get('ts')).toBe(
      String(Math.floor(Date.parse('2026-11-21T12:00:00.900Z') / 1000))
    )
  })

  it('uses a configurable origin', async () => {
    const link = new URL(
      await buildOnboardingLink({ ...base, origin: 'http://localhost:5173' })
    )

    expect(link.origin).toBe('http://localhost:5173')
    expect(link.pathname).toBe(`/connect/${PARTNER_ID}`)
    // The origin is not signed: the same signature as the default.
    expect(link.searchParams.get('signature')).toBe(MINIMAL_SIGNATURE)
  })

  it('round-trips awkward characters through the query string', async () => {
    const state = 'a b&c=d+e%f/é'
    const link = new URL(await buildOnboardingLink({ ...base, state }))

    expect(link.searchParams.get('state')).toBe(state)
  })
})

describe('buildOnboardingLink() — accepts the documented limits', () => {
  it('externalRef of 128 characters, name of 200, state of 256, redirectUrl of 2048', async () => {
    const redirectUrl = `https://partner.example/${'a'.repeat(2048 - 'https://partner.example/'.length)}`
    expect(redirectUrl).toHaveLength(2048)

    await expect(
      buildOnboardingLink({
        ...base,
        externalRef: 'a'.repeat(128),
        name: 'n'.repeat(200),
        state: 's'.repeat(256),
        redirectUrl,
      })
    ).resolves.toMatch(/^https:\/\/app\.routa\.chat\/connect\//)
  })

  it('every character of the external_ref alphabet', async () => {
    await expect(
      buildOnboardingLink({ ...base, externalRef: 'Az09._:-' })
    ).resolves.toBeTypeOf('string')
  })
})

describe('buildOnboardingLink() — refuses what the API would refuse silently', () => {
  const longRedirect = `https://partner.example/${'a'.repeat(2048)}`

  const cases: readonly (readonly [string, Record<string, unknown>, RegExp])[] =
    [
      [
        'partnerId without the ptn_ prefix',
        { partnerId: 'org_TestPartner0000000000' },
        /partnerId/,
      ],
      ['partnerId too short', { partnerId: 'ptn_abc' }, /partnerId/],
      [
        'partnerId with a line break',
        { partnerId: 'ptn_TestPartner00000\n0000' },
        /partnerId/,
      ],
      ['empty signingSecret', { signingSecret: '' }, /signingSecret/],
      [
        'a partner key as the signingSecret',
        { signingSecret: 'rt_partner_abcdef' },
        /signingSecret.*partner key/,
      ],
      ['empty externalRef', { externalRef: '' }, /externalRef/],
      ['externalRef over 128', { externalRef: 'a'.repeat(129) }, /externalRef/],
      ['externalRef with a space', { externalRef: 'lead 123' }, /externalRef/],
      [
        'externalRef that is an email',
        { externalRef: 'ze@example.com' },
        /externalRef/,
      ],
      [
        'externalRef with a line break',
        { externalRef: 'lead\n123' },
        /externalRef/,
      ],
      ['empty name', { name: '' }, /name.*empty/],
      ['name over 200', { name: 'n'.repeat(201) }, /name.*200/],
      ['name with \\n', { name: 'Acme\nLtda' }, /name.*line break/],
      ['name with \\r', { name: 'Acme\rLtda' }, /name.*line break/],
      ['empty state', { state: '' }, /state.*empty/],
      ['state over 256', { state: 's'.repeat(257) }, /state.*256/],
      ['state with \\n', { state: 'a\nb' }, /state.*line break/],
      ['state with \\r', { state: 'a\rb' }, /state.*line break/],
      ['empty redirectUrl', { redirectUrl: '' }, /redirectUrl.*empty/],
      [
        'redirectUrl over 2048',
        { redirectUrl: longRedirect },
        /redirectUrl.*2048/,
      ],
      [
        'redirectUrl with http',
        { redirectUrl: 'http://partner.example/x' },
        /redirectUrl.*https/,
      ],
      [
        'redirectUrl with another scheme',
        { redirectUrl: 'javascript:alert(1)' },
        /redirectUrl/,
      ],
      [
        'redirectUrl that is not a URL',
        { redirectUrl: 'partner.example/x' },
        /redirectUrl/,
      ],
      [
        'redirectUrl with user information',
        { redirectUrl: 'https://user:pw@partner.example/x' },
        /redirectUrl.*user information/,
      ],
      [
        'redirectUrl with a line break',
        { redirectUrl: 'https://partner.example/x\ny' },
        /redirectUrl.*line break/,
      ],
      [
        'redirectUrl with a space',
        { redirectUrl: 'https://partner.example/a b' },
        /redirectUrl.*space/,
      ],
      [
        'redirectUrl with a backslash',
        { redirectUrl: 'https://partner.example\\x' },
        /redirectUrl.*backslash/,
      ],
      ['an invalid origin', { origin: 'not a url' }, /origin/],
      ['an invalid now', { now: new Date('nope') }, /now/],
    ]

  it.each(cases)('%s', async (_label, override, message) => {
    await expect(buildOnboardingLink({ ...base, ...override })).rejects.toThrow(
      message
    )
  })

  it('never echoes the signing secret in an error', async () => {
    await expect(
      buildOnboardingLink({ ...base, externalRef: '', signingSecret: SECRET })
    ).rejects.not.toThrow(/TESTVECTORSECRET/)
  })
})
