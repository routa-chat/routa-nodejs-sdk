import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { extractCodeBlocks, typecheckSnippets } from './typecheck-snippets'

/**
 * The README's code is the first thing a user copies, so it is held to the real
 * API: every `ts` block is compiled against `src/index.ts`. It is compiled, not
 * run — the blocks hold placeholders (`rt_live_...`, `chan_...`) and need a real
 * channel, which no unit test has. What this catches is the failure that actually
 * happens: a rename, a removed field or a changed signature that leaves the
 * README showing code that no longer compiles.
 */
const README = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../README.md'),
  'utf8'
)
const TS_BLOCKS = extractCodeBlocks(README).filter(
  block => block.language === 'ts'
)

describe('README code blocks', () => {
  it('finds the blocks, including the template and media ones', () => {
    const code = TS_BLOCKS.map(block => block.code).join('\n')

    expect(TS_BLOCKS.length).toBeGreaterThanOrEqual(15)
    expect(code).toContain('routa.media.upload(')
    expect(code).toContain('routa.templates.uploadMedia(')
    expect(code).toContain('routa.templates.submit(')
    expect(code).toContain('RoutaBillingError')
  })

  it('finds the Partner API cycle, imported from the subpath', () => {
    const code = TS_BLOCKS.map(block => block.code).join('\n')

    expect(code).toContain("from '@routa-chat/sdk/partner'")
    expect(code).toContain('partner.projects.create(')
    expect(code).toContain('partner.projects.apiKeys.create(')
    expect(code).toContain('buildOnboardingLink(')
    expect(code).toContain('partner.projects.retrieve(')
    expect(code).toContain('new Routa(projectApiKey)')
  })

  it('every ts block compiles against the SDK source', () => {
    const output = typecheckSnippets(
      TS_BLOCKS.map(block => ({
        name: `block-${String(block.line).padStart(4, '0')}.ts`,
        code: block.code,
      }))
    )

    // A file name is `block-<README line of the opening fence>.ts`, so a
    // diagnostic points straight at the README.
    expect(output).toBe('')
  })

  it('does catch a block that no longer compiles (control)', () => {
    const output = typecheckSnippets([
      {
        name: 'block-0001.ts',
        // A `media` header must carry its `mediaId`; this is the kind of drift the check exists for.
        code: `await routa.templates.submit({
  channel: 'chan_...',
  name: 'order_shipped',
  language: 'en_US',
  category: 'utility',
  bodyText: 'Your order has shipped.',
  components: { header: { kind: 'media' } },
})`,
      },
    ])

    expect(output).toContain('block-0001.ts')
    expect(output).toContain('error TS')
  })
})
