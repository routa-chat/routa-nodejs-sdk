import { test } from 'vitest'
import { Routa } from '../../src/client'
import type { RoutaConfig } from '../../src/config'

test('RoutaConfig requires apiKey', () => {
  // @ts-expect-error — `apiKey` is required; omitting it must fail to compile.
  const missingApiKey: RoutaConfig = {}
  void missingApiKey

  const withApiKey: RoutaConfig = { apiKey: 'rt_test_123' }
  void withApiKey
})

test('Routa accepts either a full config object or a plain apiKey string', () => {
  void new Routa({ apiKey: 'rt_test_123' })
  void new Routa('rt_test_123')

  // @ts-expect-error — neither an object without apiKey nor a non-string, non-config value is accepted.
  void new Routa({})
  // @ts-expect-error — a number is not a valid apiKey shorthand.
  void new Routa(123)
})
