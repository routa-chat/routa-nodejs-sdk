/**
 * Self-service tenant setup for conformance scenarios that need *an*
 * authenticated project but not necessarily one with a working channel —
 * every call here is a real HTTP request against the control-plane routes a
 * real dashboard would use (sign up, log in, create a project, issue an API
 * key), never a database shortcut. A fresh organization/project/key per
 * scenario keeps error-mapping and rate-limit scenarios from interfering
 * with each other's quotas.
 *
 * Signing up is the expensive step: the reference API caps sign-ups per IP
 * (5 an hour by default), and every conformance file shares the IP. So a test
 * file provisions its project once with `sharedProject()` and issues one key
 * per test with `issueApiKey()`; only a scenario that exhausts a per-project
 * quota (the send burst) calls `provisionProject()` for a project of its own.
 */

export interface ProvisionedProject {
  readonly organizationId: string
  readonly projectId: string
  readonly sessionCookie: string
}

export interface ProvisionedApiKey {
  readonly id: string
  readonly secret: string
}

const SIGN_UP_RATE_LIMITED_MESSAGE = [
  'organization sign-up was rate limited (429) by the reference API.',
  'It caps sign-ups per IP (5 an hour by default) and the conformance suite',
  'signs up a few organizations per run. To run the suite repeatedly, start',
  'the reference API with a higher limit, for example',
  'AUTH_RATE_LIMIT_SIGNUP_IP_LIMIT=1000 (window: AUTH_RATE_LIMIT_SIGNUP_IP_WINDOW_SECONDS),',
  "or wait for the window to pass. The counter lives in the API's Redis, so",
  'restarting the API alone does not reset it.',
].join(' ')

async function parseJson<T>(response: Response, action: string): Promise<T> {
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${action} failed: ${response.status} ${text}`)
  }
  return JSON.parse(text) as T
}

/** Signs up a fresh organization, logs in, and creates a `live` project — the minimum any data-plane call needs. */
export async function provisionProject(
  baseUrl: string
): Promise<ProvisionedProject> {
  const email = `sdk-conformance-${crypto.randomUUID()}@example.test`
  const password = 'correct horse battery staple'

  const signUpResponse = await fetch(`${baseUrl}/v1/organizations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'SDK Conformance Suite',
      owner_email: email,
      owner_password: password,
    }),
  })
  if (signUpResponse.status === 429) {
    throw new Error(SIGN_UP_RATE_LIMITED_MESSAGE)
  }
  const organization = await parseJson<{ id: string }>(
    signUpResponse,
    'organization sign-up'
  )

  const loginResponse = await fetch(`${baseUrl}/v1/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const setCookie = loginResponse.headers.get('set-cookie')
  const sessionCookie = setCookie?.split(';')[0]
  if (!loginResponse.ok || !sessionCookie) {
    throw new Error(
      `login failed: ${loginResponse.status} ${await loginResponse.text()}`
    )
  }

  const projectResponse = await fetch(`${baseUrl}/v1/projects`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: sessionCookie,
    },
    body: JSON.stringify({
      name: 'SDK Conformance Suite',
      environment: 'live',
    }),
  })
  const project = await parseJson<{ id: string }>(
    projectResponse,
    'project creation'
  )

  return {
    organizationId: organization.id,
    projectId: project.id,
    sessionCookie,
  }
}

/** Issues an API key scoped exactly to `scopes` on an already-provisioned project. */
export async function issueApiKey(
  baseUrl: string,
  project: ProvisionedProject,
  scopes: readonly string[]
): Promise<ProvisionedApiKey> {
  const response = await fetch(
    `${baseUrl}/v1/projects/${project.projectId}/api_keys`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: project.sessionCookie,
      },
      body: JSON.stringify({ scopes }),
    }
  )
  return parseJson<ProvisionedApiKey>(response, 'API key issuance')
}

const sharedProjects = new Map<string, Promise<ProvisionedProject>>()

/**
 * The project every test in the calling file shares: provisioned on first
 * use, then reused. The cache lives in this module, and vitest gives each
 * test file its own module instance, so files never share a project (and
 * never each other's quotas). The promise is cached, not the result, so
 * concurrent callers also share one sign-up — and a failed sign-up is not
 * retried by every following test.
 */
export function sharedProject(baseUrl: string): Promise<ProvisionedProject> {
  let project = sharedProjects.get(baseUrl)
  if (project === undefined) {
    project = provisionProject(baseUrl)
    sharedProjects.set(baseUrl, project)
  }
  return project
}

/** A fresh project of its own and a key scoped exactly to `scopes` — for scenarios that exhaust a per-project quota. */
export async function provisionApiKey(
  baseUrl: string,
  scopes: readonly string[]
): Promise<{ project: ProvisionedProject; apiKey: ProvisionedApiKey }> {
  const project = await provisionProject(baseUrl)
  const apiKey = await issueApiKey(baseUrl, project, scopes)
  return { project, apiKey }
}

/** The calling file's shared project and a new key scoped exactly to `scopes`, ready to authenticate a data-plane call. */
export async function provisionSharedApiKey(
  baseUrl: string,
  scopes: readonly string[]
): Promise<{ project: ProvisionedProject; apiKey: ProvisionedApiKey }> {
  const project = await sharedProject(baseUrl)
  const apiKey = await issueApiKey(baseUrl, project, scopes)
  return { project, apiKey }
}

/** Every scope a data-plane conformance scenario is likely to need — mirrors what a real dashboard grants a general-purpose key. */
export const FULL_DATA_PLANE_SCOPES = [
  'messages:write',
  'messages:read',
  'webhooks:write',
  'events:read',
] as const
