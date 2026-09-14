import { describe, expect, it } from 'vitest'
import { type RoutaConfig, resolveConfig } from '../../src/config'

describe('resolveConfig', () => {
  it('throws synchronously when apiKey is missing', () => {
    // @ts-expect-error — apiKey is required; this exercises the runtime
    // guard a plain-JavaScript caller would still be able to trigger.
    expect(() => resolveConfig({})).toThrow(/apiKey/)
  })

  it('throws synchronously when apiKey is an empty string', () => {
    expect(() => resolveConfig({ apiKey: '' })).toThrow(/apiKey/)
  })

  it('fills in every default when only apiKey is provided', () => {
    const resolved = resolveConfig({ apiKey: 'rt_test_123' })

    expect(resolved.apiKey).toBe('rt_test_123')
    expect(resolved.baseURL).toBe('https://api.routa.chat')
    expect(resolved.timeout).toBe(30_000)
    expect(resolved.maxRetries).toBe(3)
    expect(resolved.fetch).toBeTypeOf('function')
    expect(resolved.logger.debug).toBeTypeOf('function')
  })

  it('preserves every explicitly provided option', () => {
    const customFetch: typeof fetch = async () => new Response(null)
    const config: RoutaConfig = {
      apiKey: 'rt_test_123',
      baseURL: 'http://localhost:3000',
      timeout: 5_000,
      maxRetries: 0,
      fetch: customFetch,
    }

    const resolved = resolveConfig(config)

    expect(resolved.baseURL).toBe('http://localhost:3000')
    expect(resolved.timeout).toBe(5_000)
    expect(resolved.maxRetries).toBe(0)
    expect(resolved.fetch).toBe(customFetch)
  })

  it('accepts a plain apiKey string as shorthand for { apiKey }', () => {
    const resolved = resolveConfig('rt_test_123')

    expect(resolved.apiKey).toBe('rt_test_123')
    expect(resolved.baseURL).toBe('https://api.routa.chat')
  })

  it('throws synchronously when the shorthand apiKey string is empty', () => {
    expect(() => resolveConfig('')).toThrow(/apiKey/)
  })
})
