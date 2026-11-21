import { describe, expect, it } from 'vitest'
import {
  type Change,
  diffOpenApi,
  formatReport,
} from '../../../scripts/openapi-diff'

type Json = Record<string, unknown>

function jsonBody(schema: Json): Json {
  return { content: { 'application/json': { schema } } }
}

function document(paths: Json): Json {
  return { openapi: '3.0.3', paths }
}

function getOperation(responses: Json, extra: Json = {}): Json {
  return { get: { responses, ...extra } }
}

function changesOf(report: ReturnType<typeof diffOpenApi>, key: string) {
  return report.changed.find(operation => operation.key === key)?.changes ?? []
}

const stringSchema = { type: 'string' }

describe('diffOpenApi', () => {
  it('reports a new response field', () => {
    const before = document({
      '/v1/things': getOperation({
        '200': jsonBody({
          type: 'object',
          properties: { id: stringSchema },
        }),
      }),
    })
    const after = document({
      '/v1/things': getOperation({
        '200': jsonBody({
          type: 'object',
          properties: { id: stringSchema, origin: stringSchema },
        }),
      }),
    })

    const report = diffOpenApi(before, after)

    expect(report.added).toEqual([])
    expect(report.removed).toEqual([])
    expect(changesOf(report, 'GET /v1/things')).toEqual<Change[]>([
      { kind: 'field-added', path: 'response.200.body.origin', to: 'string' },
    ])
  })

  it('reports removed fields and type changes', () => {
    const before = document({
      '/v1/things': getOperation({
        '200': jsonBody({
          type: 'object',
          properties: { id: stringSchema, size: { type: 'integer' } },
        }),
      }),
    })
    const after = document({
      '/v1/things': getOperation({
        '200': jsonBody({
          type: 'object',
          properties: { size: stringSchema },
        }),
      }),
    })

    expect(changesOf(diffOpenApi(before, after), 'GET /v1/things')).toEqual<
      Change[]
    >([
      { kind: 'field-removed', path: 'response.200.body.id', from: 'string' },
      {
        kind: 'type-changed',
        path: 'response.200.body.size',
        from: 'integer',
        to: 'string',
      },
    ])
  })

  it('reports a new const in a union of consts', () => {
    const union = (...values: string[]): Json => ({
      anyOf: values.map(value => ({ const: value, type: 'string' })),
    })
    const withStatuses = (...values: string[]): Json =>
      document({
        '/v1/things': getOperation({
          '200': jsonBody({
            type: 'object',
            properties: { status: union(...values) },
          }),
        }),
      })

    const report = diffOpenApi(
      withStatuses('approved', 'rejected'),
      withStatuses('approved', 'rejected', 'failed')
    )

    expect(changesOf(report, 'GET /v1/things')).toEqual<Change[]>([
      {
        kind: 'values-changed',
        path: 'response.200.body.status',
        added: ['"failed"'],
        removed: [],
      },
    ])
  })

  it('treats a union of consts and an enum as the same thing', () => {
    const asUnion = document({
      '/v1/things': getOperation({
        '200': jsonBody({
          anyOf: [
            { const: 'a', type: 'string' },
            { const: 'b', type: 'string' },
          ],
        }),
      }),
    })
    const asEnum = document({
      '/v1/things': getOperation({
        '200': jsonBody({ type: 'string', enum: ['b', 'a'] }),
      }),
    })

    expect(diffOpenApi(asUnion, asEnum).changed).toEqual([])
  })

  it('reports removed and added operations', () => {
    const before = document({
      '/v1/old': { get: { summary: 'Old', responses: {} } },
      '/v1/kept': { get: { responses: {} } },
    })
    const after = document({
      '/v1/kept': { get: { responses: {} } },
      '/v1/new': {
        post: { summary: 'New', responses: {} },
        get: { responses: {} },
      },
    })

    const report = diffOpenApi(before, after)

    expect(report.removed).toEqual([{ key: 'GET /v1/old', summary: 'Old' }])
    expect(report.added).toEqual([
      { key: 'GET /v1/new', summary: undefined },
      { key: 'POST /v1/new', summary: 'New' },
    ])
    expect(report.changed).toEqual([])
  })

  describe('nullable', () => {
    const nullableThroughAnyOf = {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    }

    it('does not treat different spellings of nullable as a change', () => {
      const spellings = [
        nullableThroughAnyOf,
        { type: 'string', nullable: true },
        { type: ['string', 'null'] },
        { anyOf: [{ anyOf: [{ type: 'string' }] }, { type: 'null' }] },
      ]
      const wrap = (schema: Json): Json =>
        document({
          '/v1/things': getOperation({
            '200': jsonBody({
              type: 'object',
              properties: { name: schema },
            }),
          }),
        })

      for (const left of spellings) {
        for (const right of spellings) {
          expect(diffOpenApi(wrap(left), wrap(right)).changed).toEqual([])
        }
      }
    })

    it('does not turn a nullable union into a type change', () => {
      const variants = [
        {
          type: 'object',
          required: ['type'],
          properties: { type: { const: 'text', type: 'string' } },
        },
      ]
      const wrap = (schema: Json): Json =>
        document({
          '/v1/things': getOperation({
            '200': jsonBody({
              type: 'object',
              properties: { content: schema },
            }),
          }),
        })

      const changes = changesOf(
        diffOpenApi(
          wrap({ anyOf: variants }),
          wrap({ anyOf: [{ anyOf: variants }, { type: 'null' }] })
        ),
        'GET /v1/things'
      )

      expect(changes.filter(change => change.kind === 'type-changed')).toEqual(
        []
      )
      expect(changes).toEqual<Change[]>([
        {
          kind: 'nullable-changed',
          path: 'response.200.body.content',
          nullable: true,
        },
      ])
    })
  })

  it('keeps every 2xx of a route apart instead of flattening them', () => {
    const accepted = jsonBody({
      type: 'object',
      properties: { status: { const: 'deleting', type: 'string' } },
    })
    const operation = (responses: Json): Json => ({
      '/v1/things/{id}': { delete: { responses } },
    })

    const report = diffOpenApi(
      document(operation({ '204': { description: 'Deleted' } })),
      document(
        operation({ '202': accepted, '204': { description: 'Deleted' } })
      )
    )

    expect(changesOf(report, 'DELETE /v1/things/{id}')).toEqual<Change[]>([
      { kind: 'field-added', path: 'response.202', to: 'any' },
      { kind: 'field-added', path: 'response.202.body', to: 'object' },
      {
        kind: 'field-added',
        path: 'response.202.body.status',
        to: 'string = "deleting"',
      },
    ])
  })

  it('ignores media types other than application/json', () => {
    const schema = (extra: Json): Json => ({
      type: 'object',
      properties: { id: stringSchema, ...extra },
    })
    const body = (extra: Json): Json => ({
      content: {
        'application/json': { schema: schema({}) },
        'multipart/form-data': { schema: schema(extra) },
        'text/plain': { schema: schema(extra) },
      },
    })

    const report = diffOpenApi(
      document({ '/v1/things': { post: { requestBody: body({}) } } }),
      document({
        '/v1/things': { post: { requestBody: body({ noise: stringSchema }) } },
      })
    )

    expect(report.changed).toEqual([])
  })

  it('compares request query parameters', () => {
    const withParameters = (...names: string[]): Json =>
      document({
        '/v1/things': getOperation(
          {},
          {
            parameters: names.map(name => ({
              name,
              in: 'query',
              schema: stringSchema,
            })),
          }
        ),
      })

    expect(
      changesOf(
        diffOpenApi(withParameters('limit'), withParameters('limit', 'q')),
        'GET /v1/things'
      )
    ).toEqual<Change[]>([
      { kind: 'field-added', path: 'request.query.q', to: 'string' },
    ])
  })

  it('merges the properties of every variant of a union', () => {
    const variant = (type: string, extra: Json): Json => ({
      type: 'object',
      properties: { type: { const: type, type: 'string' }, ...extra },
    })
    const wrap = (...variants: Json[]): Json =>
      document({
        '/v1/things': getOperation({
          '200': jsonBody({
            type: 'object',
            properties: { content: { anyOf: variants } },
          }),
        }),
      })

    const changes = changesOf(
      diffOpenApi(
        wrap(variant('text', { body: stringSchema })),
        wrap(
          variant('text', { body: stringSchema }),
          variant('image', { media_id: stringSchema })
        )
      ),
      'GET /v1/things'
    )

    expect(changes).toEqual<Change[]>([
      {
        kind: 'field-added',
        path: 'response.200.body.content.media_id',
        to: 'string',
      },
      {
        kind: 'values-changed',
        path: 'response.200.body.content.type',
        added: ['"image"'],
        removed: [],
      },
    ])
  })

  it('does not unfold a self-referencing $ref forever', () => {
    const recursive = (extra: Json): Json => ({
      openapi: '3.0.3',
      components: {
        schemas: {
          Node: {
            type: 'object',
            properties: {
              child: { $ref: '#/components/schemas/Node' },
              ...extra,
            },
          },
        },
      },
      paths: {
        '/v1/tree': getOperation({
          '200': jsonBody({ $ref: '#/components/schemas/Node' }),
        }),
      },
    })

    expect(
      changesOf(
        diffOpenApi(recursive({}), recursive({ id: stringSchema })),
        'GET /v1/tree'
      )
    ).toEqual<Change[]>([
      { kind: 'field-added', path: 'response.200.body.id', to: 'string' },
    ])
  })

  it('returns an empty report for identical documents or empty input', () => {
    const empty = { added: [], removed: [], changed: [] }

    expect(diffOpenApi({}, {})).toEqual(empty)
    expect(diffOpenApi(null, document({}))).toEqual(empty)
  })
})

describe('formatReport', () => {
  it('prints a change shared by many operations only once', () => {
    const operation = (extra: Json): Json =>
      getOperation({
        '401': jsonBody({
          type: 'object',
          properties: { error: { type: 'object', properties: extra } },
        }),
      })
    const paths = (extra: Json): Json =>
      Object.fromEntries(
        ['a', 'b', 'c', 'd', 'e'].map(name => [`/v1/${name}`, operation(extra)])
      )

    const text = formatReport(
      diffOpenApi(document(paths({})), document(paths({ details: {} })))
    )

    expect(text).toContain('Operations changed: 5')
    expect(text).toContain('## Changes repeated across operations')
    expect(text).toContain('+ response.401.body.error.details')
    expect(text).toContain('[5 operations]')
    expect(text).not.toContain('## Changed operations')
  })
})
