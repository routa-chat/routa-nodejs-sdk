import type { ApiKeyScope } from '../../whoami'
import type { PartnerProjectId } from '../project/partner-project-id'
import type { ApiKeyId } from './api-key-id'

/**
 * The API key of one customer's project — the credential that project's
 * traffic is sent with (`Routa`), never the partner key. Never carries the
 * secret: see `ProjectApiKeyWithSecret`.
 */
export interface ProjectApiKey {
  readonly id: ApiKeyId
  readonly projectId: PartnerProjectId
  /** What the key is called; `null` only for a key issued before names existed. A label, never an identity. */
  readonly name: string | null
  /** The first characters of the key (`rt_live_abc`), safe to display. */
  readonly keyPrefix: string
  /** The last four characters, for support identification. */
  readonly lastFour: string
  readonly scopes: readonly ApiKeyScope[]
  readonly expiresAt: string | null
  readonly ipAllowlist: readonly string[]
  readonly createdAt: string
  readonly revokedAt: string | null
  /** Floored to the minute by the API. */
  readonly lastUsedAt: string | null
}

/**
 * A `ProjectApiKey` as returned by the two operations that mint a secret
 * (`create`, `rotate`). The full key is shown **once**, here, and never
 * again — store it before doing anything else.
 */
export interface ProjectApiKeyWithSecret extends ProjectApiKey {
  /** The full bearer secret, `rt_live_…` or `rt_test_…`. */
  readonly secret: string
}
