import type { ApiKeyScope } from '../../whoami'

/** Parameters accepted by `projects.apiKeys.create()` — mirrors the `POST /v1/partner/projects/{projectId}/api_keys` body. */
export interface CreateProjectApiKeyParams {
  /** What you call this key, e.g. `"Customer 123 backend"`; at most 80 characters once trimmed. */
  readonly name?: string
  /**
   * The scopes of the new key. Ask for the narrowest set that works — the
   * API ignores a value it does not know, so a misspelled scope is dropped
   * rather than refused.
   */
  readonly scopes: readonly ApiKeyScope[]
  /** When the key stops working: a `Date`, or an ISO 8601 string. */
  readonly expiresAt?: Date | string
  /** Addresses the key may be used from; empty or absent means any. */
  readonly ipAllowlist?: readonly string[]
}

interface CreateProjectApiKeyRequestBody {
  name?: string
  scopes: string[]
  expires_at?: string
  ip_allowlist?: string[]
}

export function serializeCreateProjectApiKeyParams(
  params: CreateProjectApiKeyParams
): CreateProjectApiKeyRequestBody {
  return {
    ...(params.name !== undefined ? { name: params.name } : {}),
    scopes: [...params.scopes],
    ...(params.expiresAt !== undefined
      ? {
          expires_at:
            typeof params.expiresAt === 'string'
              ? params.expiresAt
              : params.expiresAt.toISOString(),
        }
      : {}),
    ...(params.ipAllowlist !== undefined
      ? { ip_allowlist: [...params.ipAllowlist] }
      : {}),
  }
}
