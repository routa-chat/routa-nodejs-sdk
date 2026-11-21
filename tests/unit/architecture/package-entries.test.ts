import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Reads the real build output: `dist/` is rebuilt first, so a stale `dist/`
 * can never make these pass. They check the two properties the subpath
 * export stands on — `Routa` does not carry the partner client, and the two
 * entries share one set of error classes — against what Node actually loads
 * through the `exports` map, in ESM and in CJS. The last block goes one step
 * further and does what a user does: packs the package, installs the tarball
 * in an empty project, and imports both entries there.
 *
 * One build for the whole file, in one place: a second test file that ran
 * `tsdown` (which empties `dist/`) in parallel would race with these.
 */
const ROOT = resolve(import.meta.dirname, '../../..')
const DIST = join(ROOT, 'dist')

/**
 * Code that only the partner client has. The root bundle legitimately
 * mentions `RoutaPartner` and `/v1/partner/*` in the message of the guard that
 * refuses a partner key, so the markers are the implementation, not the name.
 */
const PARTNER_ONLY_CLASSES: readonly string[] = [
  'RoutaPartner',
  'ProjectsResource',
  'ProjectApiKeysResource',
  'PartnerChannelsResource',
  'PartnerWebhookResource',
]

const PARTNER_ONLY_STRINGS: readonly string[] = [
  'buildOnboardingLink',
  'routa-partner-link-v1',
  '/v1/partner/projects',
  '/v1/partner/channels',
  '/v1/partner/webhook',
]

/** How the bundler spells the definition of a class: `class X` or `var X = class`. */
function definesClass(source: string, name: string): boolean {
  return new RegExp(`class\\s+${name}\\b|\\b${name}\\s*=\\s*class\\b`).test(
    source
  )
}

function distFiles(extension: '.js' | '.cjs'): string[] {
  return readdirSync(DIST).filter(file => file.endsWith(extension))
}

function runNode(args: readonly string[]): string {
  return execFileSync(process.execPath, [...args], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim()
}

/** The relative modules a built file loads, so the root's closure can be walked. */
function localDependencies(file: string, source: string): string[] {
  const specifiers = [
    ...source.matchAll(
      /(?:from\s*|import\s*\(\s*|require\()["'](\.\/[^"']+)["']/g
    ),
  ].flatMap(match => (match[1] === undefined ? [] : [match[1]]))
  return specifiers
    .map(specifier => specifier.replace(/^\.\//, ''))
    .filter(
      dependency => existsSync(join(DIST, dependency)) && dependency !== file
    )
}

function closureOf(entry: string): Map<string, string> {
  const closure = new Map<string, string>()
  const pending = [entry]
  while (pending.length > 0) {
    const file = pending.pop()
    if (file === undefined || closure.has(file)) continue
    const source = readFileSync(join(DIST, file), 'utf8')
    closure.set(file, source)
    pending.push(...localDependencies(file, source))
  }
  return closure
}

beforeAll(() => {
  execFileSync(join(ROOT, 'node_modules/.bin/tsdown'), [], {
    cwd: ROOT,
    stdio: 'pipe',
  })
}, 120_000)

describe('the two package entries', () => {
  for (const [format, extension, entry] of [
    ['ESM', '.js', 'index.js'],
    ['CJS', '.cjs', 'index.cjs'],
  ] as const) {
    it(`${format}: the root entry and everything it loads carry no partner client code`, () => {
      const closure = closureOf(entry)
      expect([...closure.keys()]).toContain(entry)

      for (const [file, source] of closure) {
        for (const name of PARTNER_ONLY_CLASSES) {
          expect(definesClass(source, name), `${file} defines ${name}`).toBe(
            false
          )
        }
        for (const marker of PARTNER_ONLY_STRINGS) {
          expect(source.includes(marker), `${file} contains "${marker}"`).toBe(
            false
          )
        }
      }
    })

    it(`${format}: the partner entry does carry it, and shares chunks with the root`, () => {
      const partner = `partner${extension}`
      const source = readFileSync(join(DIST, partner), 'utf8')
      expect(definesClass(source, 'RoutaPartner')).toBe(true)
      expect(source).toContain('routa-partner-link-v1')

      // The error classes, the transport and the HMAC helper live in a shared
      // chunk: loaded by both entries, defined once.
      const shared = [...closureOf(partner).keys()].filter(
        file => file !== partner && closureOf(entry).has(file)
      )
      expect(shared.length).toBeGreaterThan(0)
      const sharedSource = shared
        .map(file => readFileSync(join(DIST, file), 'utf8'))
        .join('\n')
      expect(definesClass(sharedSource, 'RoutaApiError')).toBe(true)
      expect(
        distFiles(extension).filter(
          file => file.startsWith('index') || file.startsWith('partner')
        )
      ).toHaveLength(2)
    })
  }

  /** A fetch that answers 404 `partner_api_not_available`, then checks identity with the root's class. */
  const probe = `
    const fetch = async () =>
      new Response(
        JSON.stringify({ error: { type: 'not_found_error', code: 'partner_api_not_available', message: 'no plan', request_id: 'req_x' } }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      )
    const partner = new RoutaPartner({ partnerKey: 'rt_partner_abcdefghijklmnop', baseURL: 'http://api.test', maxRetries: 0, fetch })
    let caught
    try { await partner.projects.list().page() } catch (error) { caught = error }
    console.log(JSON.stringify({
      isApiError: caught instanceof RoutaApiError,
      isInvalidRequest: caught instanceof RoutaInvalidRequestError,
      code: caught?.code,
      rootIsFunction: typeof Routa === 'function',
    }))
  `

  const expected = {
    isApiError: true,
    isInvalidRequest: true,
    code: 'partner_api_not_available',
    rootIsFunction: true,
  }

  it('ESM: instanceof RoutaApiError (from the root) holds for an error RoutaPartner throws', () => {
    const output = runNode([
      '--input-type=module',
      '-e',
      `import { Routa, RoutaApiError, RoutaInvalidRequestError } from '@routa-chat/sdk'
       import { RoutaPartner } from '@routa-chat/sdk/partner'
       ${probe}`,
    ])
    expect(JSON.parse(output)).toEqual(expected)
  })

  it('CJS: instanceof RoutaApiError (from the root) holds for an error RoutaPartner throws', () => {
    const output = runNode([
      '-e',
      `const { Routa, RoutaApiError, RoutaInvalidRequestError } = require('@routa-chat/sdk')
       const { RoutaPartner } = require('@routa-chat/sdk/partner')
       ;(async () => { ${probe} })()`,
    ])
    expect(JSON.parse(output)).toEqual(expected)
  })

  it('both entries resolve through the exports map, with their documented exports', () => {
    const output = runNode([
      '--input-type=module',
      '-e',
      `import * as root from '@routa-chat/sdk'
       import * as partner from '@routa-chat/sdk/partner'
       console.log(JSON.stringify({
         root: 'Routa' in root, rootHasPartner: 'RoutaPartner' in root || 'buildOnboardingLink' in root,
         partner: 'RoutaPartner' in partner, link: typeof partner.buildOnboardingLink,
         partnerHasRoot: 'Routa' in partner,
       }))`,
    ])
    expect(JSON.parse(output)).toEqual({
      root: true,
      rootHasPartner: false,
      partner: true,
      link: 'function',
      partnerHasRoot: false,
    })
  })

  it('the Routa guard works from the built root too: a partner key is refused', () => {
    const output = runNode([
      '--input-type=module',
      '-e',
      `import { Routa } from '@routa-chat/sdk'
       try { new Routa('rt_partner_abcdefghijklmnop') } catch (e) { console.log(e.message.includes('RoutaPartner')) }`,
    ])
    expect(output).toBe('true')
  })
})

/**
 * What `npm pack` ships, installed the way a user installs it. `npm` and not
 * `pnpm` because `npm` comes with Node, so the test needs nothing else on the
 * machine; both pack the same files, which `files` in `package.json` decides.
 * The package has no dependencies, so the install needs no registry and runs
 * `--offline`.
 */
describe('the packed tarball, installed in an empty project', () => {
  let workDir: string
  let project: string
  let packedFiles: string[]

  const consumers = {
    esm: `import { Routa, RoutaApiError, RoutaInvalidRequestError } from '@routa-chat/sdk'
import { RoutaPartner, buildOnboardingLink } from '@routa-chat/sdk/partner'
${consumerProbe()}`,
    cjs: `const { Routa, RoutaApiError, RoutaInvalidRequestError } = require('@routa-chat/sdk')
const { RoutaPartner, buildOnboardingLink } = require('@routa-chat/sdk/partner')
;(async () => {
${consumerProbe()}
})()`,
  }

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), 'routa-sdk-pack-'))
    const packDir = join(workDir, 'pack')
    project = join(workDir, 'project')
    mkdirSync(packDir)
    mkdirSync(project)

    const packed = JSON.parse(
      execFileSync(
        'npm',
        ['pack', '--json', '--ignore-scripts', '--pack-destination', packDir],
        { cwd: ROOT, encoding: 'utf8' }
      )
    ) as { filename: string; files: { path: string }[] }[]
    const [tarball] = packed
    if (tarball === undefined) {
      throw new Error('npm pack reported no tarball')
    }
    packedFiles = tarball.files.map(file => file.path)

    writeFileSync(
      join(project, 'package.json'),
      JSON.stringify({ name: 'consumer', private: true, version: '1.0.0' })
    )
    execFileSync(
      'npm',
      [
        'install',
        join(packDir, tarball.filename),
        '--offline',
        '--no-audit',
        '--no-fund',
        '--ignore-scripts',
        '--cache',
        join(workDir, 'npm-cache'),
      ],
      { cwd: project, stdio: 'pipe' }
    )
    writeFileSync(join(project, 'consumer.mjs'), consumers.esm)
    writeFileSync(join(project, 'consumer.cjs'), consumers.cjs)
  }, 120_000)

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  it('ships only dist, README.md, LICENSE and package.json', () => {
    const outside = packedFiles.filter(
      file =>
        !file.startsWith('dist/') &&
        !['README.md', 'LICENSE', 'package.json'].includes(file)
    )
    expect(outside).toEqual([])
    expect(packedFiles).toEqual(
      expect.arrayContaining([
        'README.md',
        'LICENSE',
        'package.json',
        'dist/index.js',
        'dist/index.cjs',
        'dist/index.d.ts',
        'dist/index.d.cts',
        'dist/partner.js',
        'dist/partner.cjs',
        'dist/partner.d.ts',
        'dist/partner.d.cts',
      ])
    )
  })

  const expected = {
    root: 'function',
    partner: 'function',
    link: 'function',
    isApiError: true,
    isInvalidRequest: true,
    code: 'partner_api_not_available',
  }

  for (const [format, file] of [
    ['ESM', 'consumer.mjs'],
    ['CJS', 'consumer.cjs'],
  ] as const) {
    it(`${format}: Routa and RoutaPartner import from the installed package, and share one RoutaApiError`, () => {
      const output = execFileSync(process.execPath, [file], {
        cwd: project,
        encoding: 'utf8',
      }).trim()
      expect(JSON.parse(output)).toEqual(expected)
    })
  }
})

/** What a consumer script prints: that both entries import, and that an error `RoutaPartner` throws is the root's `RoutaApiError`. */
function consumerProbe(): string {
  return `const fetch = async () =>
  new Response(
    JSON.stringify({ error: { type: 'not_found_error', code: 'partner_api_not_available', message: 'no plan', request_id: 'req_x' } }),
    { status: 404, headers: { 'content-type': 'application/json' } }
  )
const partner = new RoutaPartner({ partnerKey: 'rt_partner_abcdefghijklmnop', baseURL: 'http://api.test', maxRetries: 0, fetch })
let caught
try { await partner.projects.list().page() } catch (error) { caught = error }
console.log(JSON.stringify({
  root: typeof Routa,
  partner: typeof RoutaPartner,
  link: typeof buildOnboardingLink,
  isApiError: caught instanceof RoutaApiError,
  isInvalidRequest: caught instanceof RoutaInvalidRequestError,
  code: caught?.code,
}))`
}
