/**
 * Shared gate for every conformance test: a real, locally running API
 * instance to send real HTTP requests to — never a mocked `fetch`. Configure via
 * environment variables:
 *
 *   ROUTA_TEST_BASE_URL    - defaults to http://localhost:3000
 *   ROUTA_TEST_API_KEY     - a real API key for that instance (messages:write,
 *                            messages:read, webhooks:write, events:read)
 *   ROUTA_TEST_CHANNEL_ID  - an active, text-capable channel id to send through
 *   ROUTA_TEST_TO          - an E.164 recipient the channel is allowed to message
 *
 * Every scenario that only needs *some* authenticated project (not
 * necessarily one with a working channel) provisions its own fresh
 * organization/project/API key over real HTTP instead of requiring these
 * variables — see `provisioning.ts`. Only scenarios that need a message to
 * actually reach `accepted` depend on `ROUTA_TEST_API_KEY`/
 * `ROUTA_TEST_CHANNEL_ID`/`ROUTA_TEST_TO`, because connecting a real channel
 * requires a provider OAuth round trip no automated suite can perform.
 *
 * Every test gated by this module skips — rather than fails — when the
 * API instance isn't reachable or a required fixture is missing, so a
 * missing local instance shows up as a skipped test, never a false pass or
 * a false failure.
 */

export const BASE_URL =
  process.env['ROUTA_TEST_BASE_URL'] ?? 'http://localhost:3000'
export const PRECONFIGURED_API_KEY = process.env['ROUTA_TEST_API_KEY']
export const PRECONFIGURED_CHANNEL_ID = process.env['ROUTA_TEST_CHANNEL_ID']
export const PRECONFIGURED_TO = process.env['ROUTA_TEST_TO']

async function checkApiReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/docs/json`, {
      signal: AbortSignal.timeout(1000),
    })
    return response.ok
  } catch {
    return false
  }
}

/** Resolved once per test file — every file that imports this pays for exactly one reachability check. */
export const apiReachable = await checkApiReachable()

/** Whether a pre-provisioned, message-capable channel is available for scenarios that need one. */
export const hasChannelFixture =
  apiReachable &&
  PRECONFIGURED_API_KEY !== undefined &&
  PRECONFIGURED_CHANNEL_ID !== undefined &&
  PRECONFIGURED_TO !== undefined

if (!apiReachable) {
  // biome-ignore lint/suspicious/noConsole: deliberate diagnostic, not leftover debugging — explains why the tests below report as skipped.
  console.warn(
    `[conformance] no reference API instance reachable at ${BASE_URL} — every scenario that depends on it will report as skipped, not passed.`
  )
} else if (!hasChannelFixture) {
  // biome-ignore lint/suspicious/noConsole: deliberate diagnostic, not leftover debugging — explains why the tests below report as skipped.
  console.warn(
    '[conformance] the reference API instance is reachable, but ROUTA_TEST_API_KEY/ROUTA_TEST_CHANNEL_ID/ROUTA_TEST_TO are not fully set — scenarios needing a working channel will report as skipped.'
  )
}

export function requireChannelFixture(): {
  apiKey: string
  channelId: string
  to: string
} {
  if (
    PRECONFIGURED_API_KEY === undefined ||
    PRECONFIGURED_CHANNEL_ID === undefined ||
    PRECONFIGURED_TO === undefined
  ) {
    throw new Error(
      'requireChannelFixture() called without the channel fixture configured — guard the call site with hasChannelFixture first.'
    )
  }
  return {
    apiKey: PRECONFIGURED_API_KEY,
    channelId: PRECONFIGURED_CHANNEL_ID,
    to: PRECONFIGURED_TO,
  }
}
