import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/conformance/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['tests/types/**/*.test-d.ts'],
    },
    environment: 'node',
  },
})
