import { describe, expect, it } from 'vitest'
import { RoutaConflictError } from '../../../src/domain/errors/routa-conflict-error'
import {
  isPartnerProjectId,
  type PartnerProjectId,
  toPartnerProjectId,
} from '../../../src/partner'
import {
  CHANNEL_ID,
  errorEnvelope,
  PARTNER_KEY,
  PROJECT_ID,
  partnerWith,
  RAW_PROJECT,
} from './support'

const projectId = toPartnerProjectId(PROJECT_ID)

describe('projects.create()', () => {
  it('sends exactly the documented body with the partner key as the Bearer credential', async () => {
    const { partner, requests } = partnerWith([
      { status: 201, body: RAW_PROJECT },
    ])

    await partner.projects.create({
      name: 'Loja do Zé',
      externalRef: 'lead_123',
    })

    const [request] = requests
    expect(request?.method).toBe('POST')
    expect(request?.url.href).toBe('http://api.test/v1/partner/projects')
    expect(JSON.parse(request?.body ?? '')).toEqual({
      name: 'Loja do Zé',
      external_ref: 'lead_123',
    })
    expect(request?.headers.get('Authorization')).toBe(`Bearer ${PARTNER_KEY}`)
    expect(request?.headers.get('Content-Type')).toBe('application/json')
  })

  it('never sends an Idempotency-Key — creation is idempotent by externalRef instead', async () => {
    const { partner, requests } = partnerWith([
      { status: 201, body: RAW_PROJECT },
    ])

    await partner.projects.create({ name: 'x', externalRef: 'lead_123' })

    expect(requests[0]?.headers.has('Idempotency-Key')).toBe(false)
  })

  it('reports created: true for 201 and created: false for 200', async () => {
    const { partner } = partnerWith([
      { status: 201, body: RAW_PROJECT },
      { status: 200, body: RAW_PROJECT },
    ])

    const first = await partner.projects.create({
      name: 'x',
      externalRef: 'lead_123',
    })
    const second = await partner.projects.create({
      name: 'x',
      externalRef: 'lead_123',
    })

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
  })

  it('parses every field of the project', async () => {
    const { partner } = partnerWith([{ status: 201, body: RAW_PROJECT }])

    const { project } = await partner.projects.create({
      name: 'Loja do Zé',
      externalRef: 'lead_123',
    })

    expect(project).toEqual({
      id: PROJECT_ID,
      name: 'Loja do Zé',
      externalRef: 'lead_123',
      environment: 'live',
      createdAt: '2026-11-20T12:00:00.000Z',
    })
  })
})

describe('projects.list()', () => {
  it('sends no query when called without filters', async () => {
    const { partner, requests } = partnerWith([
      { status: 200, body: { data: [], has_more: false, next_cursor: null } },
    ])

    await partner.projects.list().page()

    expect(requests[0]?.url.href).toBe('http://api.test/v1/partner/projects')
  })

  it('serializes every filter to its documented query param', async () => {
    const { partner, requests } = partnerWith([
      { status: 200, body: { data: [], has_more: false, next_cursor: null } },
      { status: 200, body: { data: [], has_more: false, next_cursor: null } },
    ])

    await partner.projects
      .list({
        externalRef: 'lead_123',
        hasChannel: true,
        limit: 25,
        cursor: 'c1',
      })
      .page()
    await partner.projects.list({ hasChannel: false }).page()

    expect(Object.fromEntries(requests[0]?.url.searchParams ?? [])).toEqual({
      external_ref: 'lead_123',
      has_channel: 'true',
      limit: '25',
      cursor: 'c1',
    })
    expect(requests[1]?.url.searchParams.get('has_channel')).toBe('false')
  })

  it('.page() exposes hasMore and nextCursor', async () => {
    const { partner } = partnerWith([
      {
        status: 200,
        body: { data: [RAW_PROJECT], has_more: true, next_cursor: 'next' },
      },
    ])

    const page = await partner.projects.list().page()

    expect(page.hasMore).toBe(true)
    expect(page.nextCursor).toBe('next')
    expect(page.data[0]?.id).toBe(PROJECT_ID)
  })

  it('iterates across pages, following the cursor', async () => {
    const second = { ...RAW_PROJECT, id: 'proj_01J8XA1B2C3D4E5F6G7H8J9K0N' }
    const { partner, requests } = partnerWith([
      {
        status: 200,
        body: { data: [RAW_PROJECT], has_more: true, next_cursor: 'c2' },
      },
      {
        status: 200,
        body: { data: [second], has_more: false, next_cursor: null },
      },
    ])

    const ids: string[] = []
    for await (const project of partner.projects.list()) {
      ids.push(project.id)
    }

    expect(ids).toEqual([PROJECT_ID, second.id])
    expect(requests[1]?.url.searchParams.get('cursor')).toBe('c2')
  })
})

describe('projects.retrieve()', () => {
  it('returns the project with its channels', async () => {
    const { partner, requests } = partnerWith([
      {
        status: 200,
        body: {
          ...RAW_PROJECT,
          channels: [{ id: CHANNEL_ID, status: 'active' }],
        },
      },
    ])

    const project = await partner.projects.retrieve(projectId)

    expect(requests[0]?.method).toBe('GET')
    expect(requests[0]?.url.pathname).toBe(`/v1/partner/projects/${PROJECT_ID}`)
    expect(project.channels).toEqual([{ id: CHANNEL_ID, status: 'active' }])
    expect(project.externalRef).toBe('lead_123')
  })
})

describe('projects.update()', () => {
  it('sends only the name', async () => {
    const { partner, requests } = partnerWith([
      { status: 200, body: { ...RAW_PROJECT, name: 'Novo nome' } },
    ])

    const project = await partner.projects.update(projectId, {
      name: 'Novo nome',
    })

    expect(requests[0]?.method).toBe('PATCH')
    expect(requests[0]?.url.pathname).toBe(`/v1/partner/projects/${PROJECT_ID}`)
    expect(JSON.parse(requests[0]?.body ?? '')).toEqual({ name: 'Novo nome' })
    expect(project.name).toBe('Novo nome')
  })

  it('does not forward an externalRef a plain-JavaScript caller smuggles in', async () => {
    const { partner, requests } = partnerWith([
      { status: 200, body: RAW_PROJECT },
    ])
    const params = { name: 'x', externalRef: 'other' }

    // Not a fresh object literal, so the compiler lets the extra field through
    // — exactly what a plain-JavaScript caller can do.
    await partner.projects.update(projectId, params)

    expect(JSON.parse(requests[0]?.body ?? '')).toEqual({ name: 'x' })
  })
})

describe('projects.delete()', () => {
  it('answers { status: "deleted" } for 204', async () => {
    const { partner, requests } = partnerWith([{ status: 204 }])

    const result = await partner.projects.delete(projectId)

    expect(requests[0]?.method).toBe('DELETE')
    expect(requests[0]?.url.pathname).toBe(`/v1/partner/projects/${PROJECT_ID}`)
    expect(result).toEqual({ status: 'deleted' })
  })

  it('answers { status: "deleting", projectId } for 202, so the caller repeats it', async () => {
    const { partner } = partnerWith([
      { status: 202, body: { project_id: PROJECT_ID, status: 'deleting' } },
    ])

    const result = await partner.projects.delete(projectId)

    expect(result).toEqual({ status: 'deleting', projectId: PROJECT_ID })
  })

  it('throws RoutaConflictError carrying the reason for 409 project_not_deletable', async () => {
    const { partner } = partnerWith([
      {
        status: 409,
        body: errorEnvelope(
          'conflict_error',
          'project_not_deletable',
          'It has an enabled channel.',
          { reason: 'has_enabled_channel' }
        ),
      },
    ])

    const failure = await partner.projects.delete(projectId).catch(e => e)

    expect(failure).toBeInstanceOf(RoutaConflictError)
    expect(failure.code).toBe('project_not_deletable')
    expect(failure.reason).toBe('has_enabled_channel')
  })
})

describe('PartnerProjectId', () => {
  it('validates the proj_ prefix and the ULID shape', () => {
    expect(isPartnerProjectId(PROJECT_ID)).toBe(true)
    expect(isPartnerProjectId('chan_01J8XA1B2C3D4E5F6G7H8J9K0M')).toBe(false)
    expect(isPartnerProjectId('proj_short')).toBe(false)
  })

  it('round-trips through toPartnerProjectId', () => {
    const id: PartnerProjectId = toPartnerProjectId(PROJECT_ID)
    expect(id).toBe(PROJECT_ID)
  })
})
