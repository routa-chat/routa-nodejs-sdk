import type { ApiKeyScope } from '../../whoami'
import { toPartnerProjectId } from '../project/partner-project-id'
import { toApiKeyId } from './api-key-id'
import type { ProjectApiKey, ProjectApiKeyWithSecret } from './project-api-key'

/** Wire shape of a project API key as returned by the API. */
export interface RawProjectApiKey {
  readonly id: string
  readonly project_id: string
  readonly name: string | null
  readonly key_prefix: string
  readonly last_four: string
  readonly scopes: readonly ApiKeyScope[]
  readonly expires_at: string | null
  readonly ip_allowlist: readonly string[]
  readonly created_at: string
  readonly revoked_at: string | null
  readonly last_used_at: string | null
}

/** Wire shape returned by the operations that mint a secret. */
export interface RawProjectApiKeyWithSecret extends RawProjectApiKey {
  readonly secret: string
}

export function parseProjectApiKey(raw: RawProjectApiKey): ProjectApiKey {
  return {
    id: toApiKeyId(raw.id),
    projectId: toPartnerProjectId(raw.project_id),
    name: raw.name,
    keyPrefix: raw.key_prefix,
    lastFour: raw.last_four,
    scopes: raw.scopes,
    expiresAt: raw.expires_at,
    ipAllowlist: raw.ip_allowlist,
    createdAt: raw.created_at,
    revokedAt: raw.revoked_at,
    lastUsedAt: raw.last_used_at,
  }
}

export function parseProjectApiKeyWithSecret(
  raw: RawProjectApiKeyWithSecret
): ProjectApiKeyWithSecret {
  return { ...parseProjectApiKey(raw), secret: raw.secret }
}
