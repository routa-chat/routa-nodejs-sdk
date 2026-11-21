import { afterAll, describe, expect, it } from 'vitest'
import { Routa } from '../../src/client'
import { RoutaApiError } from '../../src/domain/errors/routa-api-error'
import { RoutaInvalidRequestError } from '../../src/domain/errors/routa-invalid-request-error'
import { type PartnerProjectId, RoutaPartner } from '../../src/partner'
import {
  apiReachable,
  BASE_URL,
  hasPartnerFixture,
  PARTNER_KEY,
} from './support/environment'

/**
 * The Partner API, end to end against a real, locally running API instance.
 * No mocked `fetch` stands in for the server.
 *
 * **Needs `ROUTA_TEST_PARTNER_KEY`, and is skipped — never failed — without
 * it.** The suite cannot provision one itself: a partner key is issued by a
 * person in the dashboard (the API deliberately does not issue it, so a
 * leaked key cannot replace itself), and the organization's plan must carry
 * `partnerApi`, which an operator grants. The key needs the scopes
 * `projects:read`, `projects:write`, `api_keys:write` and `projects:delete`.
 * Each scenario creates its own project under a fresh `externalRef` and the
 * file deletes what it created at the end; the organization's project limit
 * must have room for a few.
 *
 * A failure with `404 partner_api_not_available` or `403` is reported with
 * what is missing rather than as a bare assertion, since both mean the
 * fixture is wrong, not the SDK.
 */

const created: PartnerProjectId[] = []

function newExternalRef(): string {
  return `sdk-conformance-${crypto.randomUUID()}`
}

function partnerClient(): RoutaPartner {
  if (PARTNER_KEY === undefined) {
    throw new Error('partnerClient() called without ROUTA_TEST_PARTNER_KEY.')
  }
  return new RoutaPartner({
    partnerKey: PARTNER_KEY,
    baseURL: BASE_URL,
    maxRetries: 0,
  })
}

/** Turns the two fixture mistakes into a message that says what to fix. */
async function withFixtureHelp<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (
      error instanceof RoutaApiError &&
      error.code === 'partner_api_not_available'
    ) {
      throw new Error(
        'ROUTA_TEST_PARTNER_KEY belongs to an organization whose plan has no Partner API (404 partner_api_not_available): an operator has to grant partnerApi.',
        { cause: error }
      )
    }
    if (error instanceof RoutaApiError && error.statusCode === 403) {
      throw new Error(
        `ROUTA_TEST_PARTNER_KEY lacks a scope this scenario needs (403 ${error.code}): it needs projects:read, projects:write, api_keys:write and projects:delete.`,
        { cause: error }
      )
    }
    throw error
  }
}

async function createProject(partner: RoutaPartner) {
  const result = await withFixtureHelp(() =>
    partner.projects.create({
      name: 'SDK Conformance',
      externalRef: newExternalRef(),
    })
  )
  created.push(result.project.id)
  return result
}

if (apiReachable && PARTNER_KEY === undefined) {
  // biome-ignore lint/suspicious/noConsole: deliberate diagnostic, not leftover debugging — explains why the tests below report as skipped.
  console.warn(
    '[conformance] ROUTA_TEST_PARTNER_KEY is not set — the Partner API scenarios will report as skipped, not passed.'
  )
}

describe.skipIf(!hasPartnerFixture)('Partner API — real API server', () => {
  afterAll(async () => {
    if (!hasPartnerFixture) return
    const partner = partnerClient()
    for (const id of created) {
      // Best effort: a scenario may already have deleted its project.
      await partner.projects.delete(id).catch(() => undefined)
    }
  })

  it('creating a project twice with the same externalRef returns 201 then 200, and the same project', async () => {
    const partner = partnerClient()
    const externalRef = newExternalRef()

    const first = await withFixtureHelp(() =>
      partner.projects.create({ name: 'SDK Conformance', externalRef })
    )
    created.push(first.project.id)
    const second = await partner.projects.create({
      name: 'A different name',
      externalRef,
    })

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.project.id).toBe(first.project.id)
    expect(second.project.name).toBe('SDK Conformance')
    expect(first.project).toMatchObject({
      externalRef,
      environment: expect.stringMatching(/^(live|test)$/),
    })
    expect(first.project.id).toMatch(/^proj_/)
  })

  it('retrieve() returns the project with no channels yet; update() renames it', async () => {
    const partner = partnerClient()
    const { project } = await createProject(partner)

    const retrieved = await partner.projects.retrieve(project.id)
    expect(retrieved.id).toBe(project.id)
    expect(retrieved.channels).toEqual([])

    const renamed = await partner.projects.update(project.id, {
      name: 'Renamed by the SDK',
    })
    expect(renamed.name).toBe('Renamed by the SDK')
    expect(renamed.externalRef).toBe(project.externalRef)
  })

  it('list() finds the project by externalRef, and hasChannel: false includes it', async () => {
    const partner = partnerClient()
    const { project } = await createProject(partner)

    const byRef = await partner.projects
      .list({ externalRef: project.externalRef })
      .page()
    expect(byRef.data.map(p => p.id)).toEqual([project.id])

    const ids: string[] = []
    for await (const candidate of partner.projects.list({
      hasChannel: false,
      limit: 50,
    })) {
      ids.push(candidate.id)
    }
    expect(ids).toContain(project.id)
  })

  it('issues the project key, and whoami() with it names that project', async () => {
    const partner = partnerClient()
    const { project } = await createProject(partner)

    const key = await withFixtureHelp(() =>
      partner.projects.apiKeys.create(project.id, {
        name: 'SDK Conformance key',
        scopes: ['messages:read', 'usage:read'],
      })
    )

    expect(key.secret).toMatch(/^rt_(live|test)_/)
    expect(key.projectId).toBe(project.id)
    expect(key.scopes).toEqual(['messages:read', 'usage:read'])

    const routa = new Routa({
      apiKey: key.secret,
      baseURL: BASE_URL,
      maxRetries: 0,
    })
    const identity = await routa.whoami()
    expect(identity.projectId).toBe(project.id)
    expect(identity.apiKeyId).toBe(key.id)
    expect([...identity.scopes].sort()).toEqual(['messages:read', 'usage:read'])

    const revoked = await partner.projects.apiKeys.revoke(project.id, key.id)
    expect(revoked.revokedAt).toEqual(expect.any(String))
    await expect(routa.whoami()).rejects.toBeInstanceOf(RoutaApiError)
  })

  it('rotate() issues a second working key and leaves the first one working', async () => {
    const partner = partnerClient()
    const { project } = await createProject(partner)
    const original = await withFixtureHelp(() =>
      partner.projects.apiKeys.create(project.id, { scopes: ['usage:read'] })
    )

    const replacement = await partner.projects.apiKeys.rotate(
      project.id,
      original.id
    )

    expect(replacement.id).not.toBe(original.id)
    expect(replacement.secret).not.toBe(original.secret)
    expect(replacement.scopes).toEqual(original.scopes)
    for (const { secret } of [original, replacement]) {
      const routa = new Routa({
        apiKey: secret,
        baseURL: BASE_URL,
        maxRetries: 0,
      })
      expect((await routa.whoami()).projectId).toBe(project.id)
    }
  })

  it('channels.list() pages through every channel, each in a documented state', async () => {
    const partner = partnerClient()

    const page = await withFixtureHelp(() =>
      partner.channels.list({ limit: 5 }).page()
    )

    expect(Array.isArray(page.data)).toBe(true)
    expect(typeof page.hasMore).toBe('boolean')
    for (const channel of page.data) {
      expect(['pending', 'active', 'degraded', 'disabled']).toContain(
        channel.status
      )
      expect(['cloud_api', 'coexistence']).toContain(channel.connectionMode)
      expect(channel.id).toMatch(/^chan_/)
      expect(channel.projectId).toMatch(/^proj_/)
    }

    const disabled = await partner.channels.list({ status: 'disabled' }).page()
    for (const channel of disabled.data) {
      expect(channel.status).toBe('disabled')
    }
  })

  it('delete() removes a project: deleted, then 404 on retrieve and on a second delete', async () => {
    const partner = partnerClient()
    const { project } = await createProject(partner)

    const result = await withFixtureHelp(() =>
      partner.projects.delete(project.id)
    )

    expect(result).toEqual({ status: 'deleted' })
    await expect(partner.projects.retrieve(project.id)).rejects.toBeInstanceOf(
      RoutaInvalidRequestError
    )
    await expect(partner.projects.delete(project.id)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('a project API key on a partner route is refused with 401, and a partner key on the data plane too', async () => {
    const partner = partnerClient()
    const { project } = await createProject(partner)
    const key = await withFixtureHelp(() =>
      partner.projects.apiKeys.create(project.id, { scopes: ['usage:read'] })
    )

    const projectKeyOnPartnerRoute = await fetch(
      `${BASE_URL}/v1/partner/projects`,
      {
        headers: { Authorization: `Bearer ${key.secret}` },
      }
    )
    const partnerKeyOnDataPlane = await fetch(`${BASE_URL}/v1/whoami`, {
      headers: { Authorization: `Bearer ${PARTNER_KEY}` },
    })

    expect(projectKeyOnPartnerRoute.status).toBe(401)
    expect(partnerKeyOnDataPlane.status).toBe(401)
  })
})
