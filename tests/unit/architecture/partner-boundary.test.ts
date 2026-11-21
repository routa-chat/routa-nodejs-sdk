import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(import.meta.dirname, '../../../src')
const PARTNER = join(SRC, 'partner')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return sourceFiles(path)
    }
    return entry.name.endsWith('.ts') ? [path] : []
  })
}

/** Every module specifier a TypeScript file imports or re-exports, statically or with `import()`. */
function moduleSpecifiers(source: string): string[] {
  const patterns = [
    /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  return patterns.flatMap(pattern =>
    [...source.matchAll(pattern)].flatMap(match =>
      match[1] === undefined ? [] : [match[1]]
    )
  )
}

function isInside(directory: string, path: string): boolean {
  return path === directory || path.startsWith(directory + sep)
}

/** Relative specifiers of `file` that resolve into `src/partner/`. */
function importsOfPartner(file: string, source: string): string[] {
  return moduleSpecifiers(source).filter(
    specifier =>
      specifier.startsWith('.') &&
      isInside(PARTNER, resolve(dirname(file), specifier))
  )
}

describe('the partner subpath boundary', () => {
  it('nothing in src/ outside src/partner/ imports src/partner/*', () => {
    const offenders = sourceFiles(SRC)
      .filter(file => !isInside(PARTNER, file))
      .flatMap(file =>
        importsOfPartner(file, readFileSync(file, 'utf8')).map(
          specifier => `${relative(SRC, file)} imports ${specifier}`
        )
      )

    expect(offenders).toEqual([])
  })

  it('scans a real tree: src/partner/ exists and src/ has files outside it', () => {
    const all = sourceFiles(SRC)
    expect(all.some(file => isInside(PARTNER, file))).toBe(true)
    expect(all.filter(file => !isInside(PARTNER, file)).length).toBeGreaterThan(
      20
    )
  })

  describe('the scanner itself', () => {
    const outside = join(SRC, 'message', 'x.ts')

    it.each([
      "import { RoutaPartner } from '../partner'",
      "import { RoutaPartner } from '../partner/index'",
      "export { RoutaPartner } from '../partner/routa-partner'",
      "export * from '../partner'",
      "import type { PartnerProject } from '../partner/project/partner-project'",
      "const m = await import('../partner')",
      "import '../partner/index'",
      'import {\n  RoutaPartner,\n} from "../partner"',
    ])('catches %j', source => {
      expect(importsOfPartner(outside, source)).not.toEqual([])
    })

    it.each([
      "import { Routa } from '../client'",
      "import { toId } from '../domain/branded-id'",
      "import { x } from '../partnership/thing'",
    ])('lets %j through', source => {
      expect(importsOfPartner(outside, source)).toEqual([])
    })
  })
})
