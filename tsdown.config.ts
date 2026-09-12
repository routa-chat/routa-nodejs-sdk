import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  target: 'es2022',
  platform: 'neutral',
  // Unlike tsup (which shells out to rollup-plugin-dts, pinned to TypeScript
  // 5.7 internally and crashing against TypeScript 7's compiler host API),
  // tsdown generates declarations itself against whatever TypeScript version
  // is installed — one bundled `.d.ts`/`.d.cts` pair, no separate `tsc`
  // pass and no hand-written script to duplicate one into the other.
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
})
