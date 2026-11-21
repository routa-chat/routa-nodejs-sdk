import { describe, expect, it } from 'vitest'
import { RoutaPartner } from '../../../src/partner'
import { resolvePartnerConfig } from '../../../src/partner/partner-config'
import { PARTNER_KEY } from './support'

describe('resolvePartnerConfig', () => {
  it('fills in every default, the same ones Routa uses', () => {
    const resolved = resolvePartnerConfig({ partnerKey: PARTNER_KEY })

    expect(resolved.apiKey).toBe(PARTNER_KEY)
    expect(resolved.baseURL).toBe('https://api.routa.chat')
    expect(resolved.timeout).toBe(30_000)
    expect(resolved.maxRetries).toBe(3)
    expect(resolved.fetch).toBeTypeOf('function')
    expect(resolved.logger.warn).toBeTypeOf('function')
  })

  it('preserves every explicitly provided option', () => {
    const customFetch: typeof fetch = async () => new Response(null)

    const resolved = resolvePartnerConfig({
      partnerKey: PARTNER_KEY,
      baseURL: 'http://localhost:3000',
      timeout: 5_000,
      maxRetries: 0,
      fetch: customFetch,
    })

    expect(resolved.baseURL).toBe('http://localhost:3000')
    expect(resolved.timeout).toBe(5_000)
    expect(resolved.maxRetries).toBe(0)
    expect(resolved.fetch).toBe(customFetch)
  })

  it('throws synchronously when partnerKey is missing or empty', () => {
    // @ts-expect-error — `partnerKey` is required; a plain-JavaScript caller can still omit it.
    expect(() => resolvePartnerConfig({})).toThrow(/partnerKey.*required/)
    expect(() => resolvePartnerConfig({ partnerKey: '' })).toThrow(
      /partnerKey.*required/
    )
  })

  it.each(['rt_live_abcdefghijklmnopqrstuv', 'rt_test_abcdefghijklmnopqrstuv'])(
    'says a project API key (%s) belongs to Routa',
    key => {
      expect(() => resolvePartnerConfig({ partnerKey: key })).toThrow(
        /project API key.*Use `Routa`/s
      )
    }
  )

  it('refuses any other value that is not a partner key', () => {
    expect(() => resolvePartnerConfig({ partnerKey: 'sk_whatever' })).toThrow(
      /must be a partner key.*rt_partner_/
    )
  })

  it('never echoes the key it refused', () => {
    expect(() =>
      resolvePartnerConfig({ partnerKey: 'rt_live_SECRETVALUE1234567890' })
    ).not.toThrow(/SECRETVALUE/)
  })

  it('is what the RoutaPartner constructor enforces', () => {
    expect(() => new RoutaPartner({ partnerKey: 'rt_live_abc' })).toThrow(
      /project API key/
    )
    expect(() => new RoutaPartner({ partnerKey: PARTNER_KEY })).not.toThrow()
  })
})
