import { PARTNER_KEY_PREFIX } from '../../config'
import { hmacSha256Hex } from '../../crypto/hmac-sha256-hex'

/** Where the hosted connect page lives unless `origin` says otherwise. */
const DEFAULT_ORIGIN = 'https://app.routa.chat'

/** First line of the signed string — a fixed tag, so a signature for one purpose cannot be replayed for another. */
const DOMAIN_TAG = 'routa-partner-link-v1'

const EXTERNAL_REF_MAX_LENGTH = 128
const NAME_MAX_LENGTH = 200
const STATE_MAX_LENGTH = 256
const REDIRECT_URL_MAX_LENGTH = 2048

/** `ptn_` and base62, as the dashboard shows it. Not a branded `Id`: it is not the ULID the API's resource ids are. */
const PARTNER_ID_PATTERN = /^ptn_[A-Za-z0-9]{10,64}$/
const EXTERNAL_REF_PATTERN = /^[A-Za-z0-9._:-]+$/
const LINE_BREAK = /[\r\n]/

/** Parameters of `buildOnboardingLink()`. */
export interface BuildOnboardingLinkParams {
  /** Your `ptn_…` partner id, shown in the dashboard (Settings → Partner). */
  readonly partnerId: string
  /** Your onboarding signing secret (`rt_psign_…`), shown once when the partner profile is created. Not the partner key. */
  readonly signingSecret: string
  /** Your own id for the customer: 1 to 128 of `A-Z a-z 0-9 . _ : -`. Never an email, a phone number or a name. */
  readonly externalRef: string
  /** What the project is called, up to 200 characters. Defaults to `externalRef` on Routa's side. */
  readonly name?: string
  /** Where the customer's browser returns to: `https://…`, on an origin registered in the dashboard, up to 2048 characters. */
  readonly redirectUrl?: string
  /** Opaque, up to 256 characters. Comes back to your `redirectUrl` unchanged — check it against the customer's session. */
  readonly state?: string
  /** The moment the link is signed. Defaults to now; pass it only to reproduce a link in a test. */
  readonly now?: Date
  /** Origin of the connect page, e.g. `http://localhost:5173` against a local instance. Defaults to `https://app.routa.chat`. */
  readonly origin?: string
}

/**
 * Builds the signed link a customer opens to connect their WhatsApp number:
 * `https://app.routa.chat/connect/{partnerId}?…`, signed with HMAC-SHA256
 * over a canonical string (ADR-0097 §3.1). A pure function — it makes no
 * request.
 *
 * **Sign at the moment the customer clicks, not before.** The link is
 * accepted for 10 minutes after it was signed (and up to 60 seconds ahead,
 * for clock skew), so one sent by email expires; host a redirector of your
 * own that signs on click.
 *
 * The API answers every bad link with the **same** "this link is not valid"
 * page and no diagnosis, so the customer cannot tell you why. That is why,
 * unlike the rest of the SDK, this function validates its input itself and
 * throws an `Error` naming the parameter at fault: it is the only place a
 * developer can find out. What it cannot check is on Routa's side: the
 * signing secret in use (a rotation keeps the old one for 24 hours), whether
 * `redirectUrl`'s origin is registered, and whether the plan still has the
 * Partner API.
 *
 * @throws {Error} A parameter the API would refuse silently: a value with a line break, an empty optional value, `externalRef` outside its pattern, `name` over 200, `state` over 256, `redirectUrl` over 2048 or not `https`.
 */
export async function buildOnboardingLink(
  params: BuildOnboardingLinkParams
): Promise<string> {
  const { partnerId, signingSecret, externalRef } = params
  assertPartnerId(partnerId)
  assertSigningSecret(signingSecret)
  assertExternalRef(externalRef)
  if (params.name !== undefined) {
    assertOptionalText('name', params.name, NAME_MAX_LENGTH)
  }
  if (params.state !== undefined) {
    assertOptionalText('state', params.state, STATE_MAX_LENGTH)
  }
  if (params.redirectUrl !== undefined) {
    assertRedirectUrl(params.redirectUrl)
  }
  const origin = resolveOrigin(params.origin)
  const now = params.now ?? new Date()
  if (Number.isNaN(now.getTime())) {
    throw new Error('buildOnboardingLink: `now` is not a valid Date.')
  }

  const fields: [string, string][] = [
    ['external_ref', externalRef],
    ['partner_id', partnerId],
    ['ts', String(Math.floor(now.getTime() / 1000))],
  ]
  if (params.name !== undefined) fields.push(['name', params.name])
  if (params.redirectUrl !== undefined) {
    fields.push(['redirect_url', params.redirectUrl])
  }
  if (params.state !== undefined) fields.push(['state', params.state])

  const signature = await hmacSha256Hex(
    signingSecret,
    new TextEncoder().encode(canonicalString(fields))
  )

  const url = new URL(`/connect/${partnerId}`, origin)
  for (const [name, value] of fields) {
    // `partner_id` is already in the path; the API takes it from the query too.
    url.searchParams.set(name, value)
  }
  url.searchParams.set('signature', signature)
  return url.toString()
}

/**
 * The one string the HMAC covers: the domain tag, then a `name=value` line
 * for every parameter except `signature`, the names in ascending byte order,
 * joined by `\n` with no trailing newline. The names are ASCII, so code unit
 * order is byte order.
 */
function canonicalString(
  fields: readonly (readonly [string, string])[]
): string {
  const lines = [...fields]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => `${name}=${value}`)
  return [DOMAIN_TAG, ...lines].join('\n')
}

function assertPartnerId(partnerId: string): void {
  if (!PARTNER_ID_PATTERN.test(partnerId)) {
    throw new Error(
      'buildOnboardingLink: `partnerId` must be your `ptn_…` partner id, as the dashboard shows it (Settings → Partner), `ptn_` and 10 to 64 letters or digits.'
    )
  }
}

function assertSigningSecret(signingSecret: string): void {
  if (signingSecret.length === 0) {
    throw new Error(
      'buildOnboardingLink: `signingSecret` is required. It is shown once when the partner profile is created, in the dashboard.'
    )
  }
  if (signingSecret.startsWith(PARTNER_KEY_PREFIX)) {
    throw new Error(
      'buildOnboardingLink: `signingSecret` is a partner key (`rt_partner_…`). The link is signed with the onboarding signing secret (`rt_psign_…`) instead — a different secret, shown once when the partner profile is created.'
    )
  }
}

function assertExternalRef(externalRef: string): void {
  if (
    externalRef.length === 0 ||
    externalRef.length > EXTERNAL_REF_MAX_LENGTH ||
    !EXTERNAL_REF_PATTERN.test(externalRef)
  ) {
    throw new Error(
      `buildOnboardingLink: \`externalRef\` must be 1 to ${EXTERNAL_REF_MAX_LENGTH} of A-Z a-z 0-9 . _ : - (an opaque id, never an email, a phone number or a name).`
    )
  }
}

function assertOptionalText(
  param: 'name' | 'state',
  value: string,
  maxLength: number
): void {
  if (value.length === 0) {
    throw new Error(
      `buildOnboardingLink: \`${param}\` is empty — leave it out instead.`
    )
  }
  if (value.length > maxLength) {
    throw new Error(
      `buildOnboardingLink: \`${param}\` is over ${maxLength} characters.`
    )
  }
  if (LINE_BREAK.test(value)) {
    throw new Error(
      `buildOnboardingLink: \`${param}\` contains a line break, which the signed string cannot carry.`
    )
  }
}

/** Mirrors how the API reads `redirect_url`: `https` only, no user information, no whitespace, control character or backslash, a host. */
function assertRedirectUrl(redirectUrl: string): void {
  if (redirectUrl.length === 0) {
    throw new Error(
      'buildOnboardingLink: `redirectUrl` is empty — leave it out instead.'
    )
  }
  if (redirectUrl.length > REDIRECT_URL_MAX_LENGTH) {
    throw new Error(
      `buildOnboardingLink: \`redirectUrl\` is over ${REDIRECT_URL_MAX_LENGTH} characters.`
    )
  }
  if (LINE_BREAK.test(redirectUrl)) {
    throw new Error(
      'buildOnboardingLink: `redirectUrl` contains a line break, which the signed string cannot carry.'
    )
  }
  if (hasForbiddenUrlCharacter(redirectUrl)) {
    throw new Error(
      'buildOnboardingLink: `redirectUrl` contains a space, a control character or a backslash.'
    )
  }
  let parsed: URL
  try {
    parsed = new URL(redirectUrl)
  } catch {
    throw new Error('buildOnboardingLink: `redirectUrl` is not a valid URL.')
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.hostname === ''
  ) {
    throw new Error(
      'buildOnboardingLink: `redirectUrl` must be `https://…` with a host and no user information.'
    )
  }
}

function hasForbiddenUrlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x20 || code === 0x7f || char === '\\' || /\s/u.test(char)) {
      return true
    }
  }
  return false
}

function resolveOrigin(origin: string | undefined): string {
  if (origin === undefined) {
    return DEFAULT_ORIGIN
  }
  try {
    return new URL(origin).origin
  } catch {
    throw new Error(
      'buildOnboardingLink: `origin` is not a valid URL, e.g. `https://app.routa.chat`.'
    )
  }
}
