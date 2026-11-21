import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

/** A fenced code block of a Markdown file, with where it starts so a failure can point at the README line. */
export interface CodeBlock {
  readonly language: string
  readonly code: string
  /** 1-based line of the opening fence. */
  readonly line: number
}

/** Every fenced block, in order. A fence is three backticks at the start of a line, with an optional language. */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const lines = markdown.split('\n')
  let open: { language: string; line: number; body: string[] } | undefined
  lines.forEach((text, index) => {
    const fence = /^```(\w*)\s*$/.exec(text)
    if (!fence) {
      open?.body.push(text)
      return
    }
    if (open) {
      blocks.push({
        language: open.language,
        code: open.body.join('\n'),
        line: open.line,
      })
      open = undefined
    } else {
      open = { language: fence[1] ?? '', line: index + 1, body: [] }
    }
  })
  return blocks
}

/**
 * Names the README's snippets use without defining them, because the prose
 * around them does ("send the bytes yourself"). Declared as globals, so a block
 * that defines its own `routa` (the Quickstart does) still shadows them.
 */
const AMBIENT = `import type { Routa } from '@routa-chat/sdk'

declare global {
  const routa: Routa
  const bytes: Uint8Array
}
`

/**
 * Compiles each snippet, as its own module, against the SDK's real source
 * (`@routa-chat/sdk` is mapped to `src/index.ts`) with the repository's strict
 * compiler options, and returns the compiler's diagnostics — empty when every
 * snippet compiles. It type-checks; it does not run anything, because the
 * snippets hold placeholders (`rt_live_...`, `chan_...`) and need a real
 * channel.
 *
 * The scratch directory lives under `node_modules/.cache` so `@types/node`
 * resolves from it and git ignores it, and is removed afterwards.
 */
export function typecheckSnippets(
  snippets: readonly { readonly name: string; readonly code: string }[]
): string {
  const cache = join(ROOT, 'node_modules', '.cache')
  mkdirSync(cache, { recursive: true })
  const dir = mkdtempSync(join(cache, 'readme-blocks-'))
  try {
    writeFileSync(join(dir, 'ambient.d.ts'), AMBIENT)
    for (const snippet of snippets) {
      // `export {}` makes every snippet a module, so top-level `await` is legal
      // and two snippets' `const message` cannot collide.
      writeFileSync(join(dir, snippet.name), `${snippet.code}\n\nexport {}\n`)
    }
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        extends: join(ROOT, 'tsconfig.json'),
        compilerOptions: {
          noEmit: true,
          declaration: false,
          declarationMap: false,
          typeRoots: [join(ROOT, 'node_modules', '@types')],
          paths: { '@routa-chat/sdk': [join(ROOT, 'src', 'index.ts')] },
        },
        include: ['./*.ts'],
      })
    )
    const result = spawnSync(
      process.execPath,
      [
        join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
        '-p',
        dir,
        '--pretty',
        'false',
      ],
      { encoding: 'utf8' }
    )
    if (result.error) {
      throw result.error
    }
    return `${result.stdout}${result.stderr}`.trim()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
