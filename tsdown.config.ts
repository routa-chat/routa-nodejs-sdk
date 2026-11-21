import { defineConfig } from 'tsdown'

export default defineConfig({
  // Two entry points. `partner` is the experimental Partner API client; the
  // bundler extracts whatever both entries use (the HTTP transport, the error
  // classes, the HMAC helper) into shared chunks, so `RoutaApiError` is one
  // class for both and `error instanceof RoutaApiError` holds across them.
  // `index` must never reach `src/partner/` — tests/unit/architecture proves it.
  entry: {
    index: 'src/index.ts',
    partner: 'src/partner/index.ts',
  },
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
