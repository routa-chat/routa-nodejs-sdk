/**
 * Compares two OpenAPI documents operation by operation and reports what the
 * SDK might have to follow: new or removed operations, request and response
 * fields that appeared, disappeared or changed type, and `enum`/`const`
 * values that were added or removed.
 *
 * Usage:
 *   node scripts/openapi-diff.ts <old.json> <new.json> [--json]
 *
 * It only reads `application/json` bodies: the Elysia generator repeats every
 * schema under `multipart/form-data` and `text/plain`, which is pure noise.
 * Schemas are inline (`components.schemas` is empty in the Routa document), so
 * fields are compared by their path, never by type name.
 *
 * Normalisation rules, so that equivalent spellings do not show up as changes:
 * - `anyOf`/`oneOf`/`allOf` are flattened into one union: the types, the
 *   literal values and the properties of every variant are merged.
 * - `{ type: 'null' }` variants, `nullable: true` and `type: [..., 'null']`
 *   all mean "nullable". Nullability is reported on its own, never as a type
 *   change.
 * - `const: x` and a one-value `enum` are the same thing; a union of `const`
 *   variants is the same as an `enum`.
 * - Every status code of an operation is kept apart (a route may document both
 *   `202` and `204`).
 *
 * Only `node:fs` is used: Node 22.18+ runs this `.ts` file directly.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const HTTP_METHODS: readonly string[] = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]

/** The only media type compared; see the file comment. */
const JSON_MEDIA_TYPE = 'application/json'

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** What is known about one field path after flattening every union variant. */
export interface FieldShape {
  /** JSON types seen, without `null` (see `nullable`). */
  readonly types: ReadonlySet<string>
  /** Literal values from `const`/`enum`, serialised with `JSON.stringify`. */
  readonly values: ReadonlySet<string>
  readonly nullable: boolean
}

interface MutableShape {
  types: Set<string>
  values: Set<string>
  nullable: boolean
}

/** One operation reduced to `field path -> shape`. */
type OperationShape = Map<string, FieldShape>

/** What a schema looks like once `anyOf`, `oneOf`, `allOf` and `$ref` are gone. */
interface FlatSchema extends MutableShape {
  /** Every schema that contributes `properties` at this path. */
  objects: JsonObject[]
  /** Every schema that describes array elements at this path. */
  items: unknown[]
  /** Every `$ref` followed to flatten this schema. */
  refs: Set<string>
}

export type Change =
  | { readonly kind: 'field-added'; readonly path: string; readonly to: string }
  | {
      readonly kind: 'field-removed'
      readonly path: string
      readonly from: string
    }
  | {
      readonly kind: 'type-changed'
      readonly path: string
      readonly from: string
      readonly to: string
    }
  | {
      readonly kind: 'values-changed'
      readonly path: string
      readonly added: readonly string[]
      readonly removed: readonly string[]
    }
  | {
      readonly kind: 'nullable-changed'
      readonly path: string
      readonly nullable: boolean
    }

export interface OperationRef {
  /** Upper-case method and path, e.g. `POST /v1/messages`. */
  readonly key: string
  readonly summary: string | undefined
}

export interface OperationChange {
  readonly key: string
  readonly changes: readonly Change[]
}

export interface DiffReport {
  readonly added: readonly OperationRef[]
  readonly removed: readonly OperationRef[]
  readonly changed: readonly OperationChange[]
}

function describeShape(shape: FieldShape): string {
  const types = [...shape.types].sort().join(' | ') || 'any'
  const values =
    shape.values.size > 0 ? ` = ${[...shape.values].sort().join(' | ')}` : ''
  return `${types}${shape.nullable ? ' | null' : ''}${values}`
}

function describeType(shape: FieldShape): string {
  return [...shape.types].sort().join(' | ') || 'any'
}

/** Follows a local `#/...` reference; `seen` stops reference cycles. */
function resolveRef(
  root: unknown,
  ref: string,
  seen: ReadonlySet<string>
): unknown {
  if (seen.has(ref) || !ref.startsWith('#/')) return undefined
  let node: unknown = root
  for (const segment of ref.slice(2).split('/')) {
    const key = segment.replaceAll('~1', '/').replaceAll('~0', '~')
    if (!isObject(node)) return undefined
    node = node[key]
  }
  return node
}

function flatten(
  root: unknown,
  schema: unknown,
  seen: ReadonlySet<string>,
  into: FlatSchema
): void {
  if (!isObject(schema)) return

  const ref = schema['$ref']
  if (typeof ref === 'string') {
    into.refs.add(ref)
    flatten(root, resolveRef(root, ref, seen), new Set([...seen, ref]), into)
    return
  }

  for (const keyword of ['anyOf', 'oneOf', 'allOf']) {
    const variants = schema[keyword]
    if (Array.isArray(variants)) {
      for (const variant of variants) flatten(root, variant, seen, into)
    }
  }

  const type = schema['type']
  for (const name of Array.isArray(type) ? type : [type]) {
    if (typeof name !== 'string') continue
    if (name === 'null') into.nullable = true
    else into.types.add(name)
  }
  if (schema['nullable'] === true) into.nullable = true

  if ('const' in schema) into.values.add(JSON.stringify(schema['const']))
  const members = schema['enum']
  if (Array.isArray(members)) {
    for (const member of members) into.values.add(JSON.stringify(member))
  }

  if (isObject(schema['properties'])) {
    into.objects.push(schema)
    into.types.add('object')
  }
  if (schema['items'] !== undefined) {
    into.items.push(schema['items'])
    into.types.add('array')
  }
}

function emptyFlat(): FlatSchema {
  return {
    types: new Set(),
    values: new Set(),
    nullable: false,
    objects: [],
    items: [],
    refs: new Set(),
  }
}

/** Merges `shape` into whatever is already recorded at `path`. */
function record(shapes: OperationShape, path: string, shape: FlatSchema): void {
  const existing = shapes.get(path)
  shapes.set(path, {
    types: new Set([...(existing?.types ?? []), ...shape.types]),
    values: new Set([...(existing?.values ?? []), ...shape.values]),
    nullable: (existing?.nullable ?? false) || shape.nullable,
  })
}

/**
 * Records `schema` at `path` and at every field below it.
 *
 * `ancestors` holds the `$ref`s being expanded on the way down: a schema that
 * refers back to one of them is recursive, so it is recorded but not entered
 * again (the document would otherwise unfold forever).
 */
function collect(
  root: unknown,
  schema: unknown,
  path: string,
  shapes: OperationShape,
  ancestors: ReadonlySet<string> = new Set()
): void {
  const flat = emptyFlat()
  flatten(root, schema, new Set(), flat)
  record(shapes, path, flat)
  if ([...flat.refs].some(ref => ancestors.has(ref))) return

  const inside = new Set([...ancestors, ...flat.refs])
  for (const object of flat.objects) {
    const properties = object['properties']
    if (!isObject(properties)) continue
    for (const [name, child] of Object.entries(properties)) {
      collect(root, child, `${path}.${name}`, shapes, inside)
    }
  }
  for (const item of flat.items)
    collect(root, item, `${path}[]`, shapes, inside)
}

function jsonSchemaOf(content: unknown): unknown {
  if (!isObject(content)) return undefined
  const media = content[JSON_MEDIA_TYPE]
  return isObject(media) ? media['schema'] : undefined
}

function shapeOperation(root: unknown, operation: JsonObject): OperationShape {
  const shapes: OperationShape = new Map()

  const parameters = operation['parameters']
  if (Array.isArray(parameters)) {
    for (const parameter of parameters) {
      if (!isObject(parameter)) continue
      const where = parameter['in']
      const name = parameter['name']
      if (typeof where !== 'string' || typeof name !== 'string') continue
      collect(root, parameter['schema'], `request.${where}.${name}`, shapes)
    }
  }

  const requestBody = operation['requestBody']
  if (isObject(requestBody)) {
    const schema = jsonSchemaOf(requestBody['content'])
    if (schema !== undefined) collect(root, schema, 'request.body', shapes)
  }

  const responses = operation['responses']
  if (isObject(responses)) {
    for (const [status, response] of Object.entries(responses)) {
      // The status itself is a fact (`402` appearing is news) even when the
      // response has no JSON body, e.g. a `204`.
      record(shapes, `response.${status}`, emptyFlat())
      if (!isObject(response)) continue
      const schema = jsonSchemaOf(response['content'])
      if (schema !== undefined) {
        collect(root, schema, `response.${status}.body`, shapes)
      }
    }
  }

  return shapes
}

interface IndexedOperations {
  shapes: Map<string, OperationShape>
  summaries: Map<string, string | undefined>
}

function indexOperations(document: unknown): IndexedOperations {
  const shapes = new Map<string, OperationShape>()
  const summaries = new Map<string, string | undefined>()
  const paths = isObject(document) ? document['paths'] : undefined
  if (!isObject(paths)) return { shapes, summaries }

  for (const [path, item] of Object.entries(paths)) {
    if (!isObject(item)) continue
    for (const method of HTTP_METHODS) {
      const operation = item[method]
      if (!isObject(operation)) continue
      const key = `${method.toUpperCase()} ${path}`
      shapes.set(key, shapeOperation(document, operation))
      const summary = operation['summary']
      summaries.set(key, typeof summary === 'string' ? summary : undefined)
    }
  }
  return { shapes, summaries }
}

function diffShapes(before: OperationShape, after: OperationShape): Change[] {
  const changes: Change[] = []
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort()

  for (const path of paths) {
    const from = before.get(path)
    const to = after.get(path)
    if (from === undefined && to !== undefined) {
      changes.push({ kind: 'field-added', path, to: describeShape(to) })
      continue
    }
    if (from !== undefined && to === undefined) {
      changes.push({ kind: 'field-removed', path, from: describeShape(from) })
      continue
    }
    if (from === undefined || to === undefined) continue

    if (describeType(from) !== describeType(to)) {
      changes.push({
        kind: 'type-changed',
        path,
        from: describeType(from),
        to: describeType(to),
      })
    }
    const added = [...to.values].filter(value => !from.values.has(value))
    const removed = [...from.values].filter(value => !to.values.has(value))
    if (added.length > 0 || removed.length > 0) {
      changes.push({
        kind: 'values-changed',
        path,
        added: added.sort(),
        removed: removed.sort(),
      })
    }
    if (from.nullable !== to.nullable) {
      changes.push({ kind: 'nullable-changed', path, nullable: to.nullable })
    }
  }
  return changes
}

/** Compares two parsed OpenAPI documents. */
export function diffOpenApi(before: unknown, after: unknown): DiffReport {
  const old = indexOperations(before)
  const current = indexOperations(after)

  const added: OperationRef[] = []
  const removed: OperationRef[] = []
  const changed: OperationChange[] = []

  for (const key of [...current.shapes.keys()].sort()) {
    if (!old.shapes.has(key)) {
      added.push({ key, summary: current.summaries.get(key) })
    }
  }
  for (const key of [...old.shapes.keys()].sort()) {
    const next = current.shapes.get(key)
    const previous = old.shapes.get(key)
    if (previous === undefined) continue
    if (next === undefined) {
      removed.push({ key, summary: old.summaries.get(key) })
      continue
    }
    const changes = diffShapes(previous, next)
    if (changes.length > 0) changed.push({ key, changes })
  }
  return { added, removed, changed }
}

function formatChange(change: Change): string {
  switch (change.kind) {
    case 'field-added':
      return `+ ${change.path}  (${change.to})`
    case 'field-removed':
      return `- ${change.path}  (${change.from})`
    case 'type-changed':
      return `~ ${change.path}  type: ${change.from} -> ${change.to}`
    case 'values-changed': {
      const parts = [
        ...change.added.map(value => `+${value}`),
        ...change.removed.map(value => `-${value}`),
      ]
      return `~ ${change.path}  values: ${parts.join(' ')}`
    }
    case 'nullable-changed':
      return `~ ${change.path}  nullable: ${String(!change.nullable)} -> ${String(change.nullable)}`
  }
}

function formatOperation(operation: OperationRef): string {
  return operation.summary === undefined
    ? operation.key
    : `${operation.key}  — ${operation.summary}`
}

/**
 * A change that shows up in at least this many operations is a property of a
 * shared schema (the error envelope, a pagination wrapper), not of one route.
 * The text report prints it once instead of once per operation.
 */
const REPEATED_CHANGE_THRESHOLD = 5

/** Renders the report as the text the CLI prints. */
export function formatReport(report: DiffReport): string {
  const occurrences = new Map<string, number>()
  for (const operation of report.changed) {
    for (const change of operation.changes) {
      const line = formatChange(change)
      occurrences.set(line, (occurrences.get(line) ?? 0) + 1)
    }
  }
  const isRepeated = (line: string): boolean =>
    (occurrences.get(line) ?? 0) >= REPEATED_CHANGE_THRESHOLD

  const lines = [
    `Operations added: ${report.added.length}`,
    `Operations removed: ${report.removed.length}`,
    `Operations changed: ${report.changed.length}`,
  ]
  if (report.added.length > 0) {
    lines.push('', '## Added operations')
    for (const operation of report.added) {
      lines.push(`+ ${formatOperation(operation)}`)
    }
  }
  if (report.removed.length > 0) {
    lines.push('', '## Removed operations')
    for (const operation of report.removed) {
      lines.push(`- ${formatOperation(operation)}`)
    }
  }

  const repeated = [...occurrences].filter(([line]) => isRepeated(line))
  if (repeated.length > 0) {
    lines.push('', '## Changes repeated across operations')
    for (const [line, count] of repeated) {
      lines.push(`${line}  [${count} operations]`)
    }
  }

  const specific = report.changed
    .map(operation => ({
      key: operation.key,
      lines: operation.changes
        .map(formatChange)
        .filter(line => !isRepeated(line)),
    }))
    .filter(operation => operation.lines.length > 0)
  if (specific.length > 0) {
    lines.push('', '## Changed operations')
    for (const operation of specific) {
      lines.push('', operation.key)
      for (const line of operation.lines) lines.push(`  ${line}`)
    }
  }
  return `${lines.join('\n')}\n`
}

function readDocument(path: string): unknown {
  // `JSON.parse` is typed `any`; `unknown` makes every use go through a guard.
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  return parsed
}

function main(argv: readonly string[]): number {
  const json = argv.includes('--json')
  const files = argv.filter(argument => !argument.startsWith('--'))
  const [oldPath, newPath] = files
  if (oldPath === undefined || newPath === undefined || files.length > 2) {
    process.stderr.write(
      'Usage: node scripts/openapi-diff.ts <old.json> <new.json> [--json]\n'
    )
    return 2
  }
  const report = diffOpenApi(readDocument(oldPath), readDocument(newPath))
  process.stdout.write(
    json ? `${JSON.stringify(report, null, 2)}\n` : formatReport(report)
  )
  return 0
}

// Run only when executed directly, not when a test imports `diffOpenApi`.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
