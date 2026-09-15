import { describe, expect, it, vi } from 'vitest'
import type { HttpClient, HttpRequestOptions } from '../../src/http/http-client'
import { whoami } from '../../src/whoami'

function fakeHttpClient(
  requestSpy: (options: HttpRequestOptions) => unknown
): HttpClient {
  return {
    request: <T>(options: HttpRequestOptions): Promise<T> =>
      Promise.resolve(requestSpy(options)) as Promise<T>,
    requestWithHeaders: async <T>(
      options: HttpRequestOptions
    ): Promise<{ data: T; headers: Headers }> => ({
      data: (await requestSpy(options)) as T,
      headers: new Headers(),
    }),
  }
}

describe('whoami()', () => {
  it('calls GET /v1/whoami', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      organization_id: 'org_1',
      project_id: 'proj_1',
      api_key_id: 'key_1',
      scopes: ['messages:read', 'messages:write'],
    })

    await whoami(fakeHttpClient(requestSpy))

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/whoami',
    })
  })

  it('returns a parsed Whoami', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      organization_id: 'org_1',
      project_id: 'proj_1',
      api_key_id: 'key_1',
      scopes: ['messages:read', 'templates:write'],
    })

    const result = await whoami(fakeHttpClient(requestSpy))

    expect(result).toEqual({
      organizationId: 'org_1',
      projectId: 'proj_1',
      apiKeyId: 'key_1',
      scopes: ['messages:read', 'templates:write'],
    })
  })
})
