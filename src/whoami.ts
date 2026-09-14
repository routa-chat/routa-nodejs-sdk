import type { HttpClient } from './http/http-client'

/** Every permission an API key can hold. */
export type ApiKeyScope =
  | 'messages:read'
  | 'messages:write'
  | 'channels:read'
  | 'channels:write'
  | 'events:read'
  | 'webhooks:write'
  | 'usage:read'
  | 'templates:read'
  | 'templates:write'
  | 'media:read'
  | 'media:write'

/** Identity and permissions of the API key making the current call. */
export interface Whoami {
  readonly organizationId: string
  readonly projectId: string
  readonly apiKeyId: string
  readonly scopes: readonly ApiKeyScope[]
}

/** Wire shape of a `GET /v1/whoami` response. */
interface RawWhoami {
  readonly organization_id: string
  readonly project_id: string
  readonly api_key_id: string
  readonly scopes: readonly ApiKeyScope[]
}

/** `routa.whoami()` — resolves the calling API key's identity and scopes, useful for verifying a key without side effects. */
export async function whoami(http: HttpClient): Promise<Whoami> {
  const raw = await http.request<RawWhoami>({
    method: 'GET',
    path: '/v1/whoami',
  })
  return {
    organizationId: raw.organization_id,
    projectId: raw.project_id,
    apiKeyId: raw.api_key_id,
    scopes: raw.scopes,
  }
}
