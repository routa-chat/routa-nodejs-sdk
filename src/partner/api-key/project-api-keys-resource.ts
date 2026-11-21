import type { HttpClient } from '../../http/http-client'
import type { PartnerProjectId } from '../project/partner-project-id'
import type { ApiKeyId } from './api-key-id'
import {
  type CreateProjectApiKeyParams,
  serializeCreateProjectApiKeyParams,
} from './create-project-api-key'
import type { ProjectApiKey, ProjectApiKeyWithSecret } from './project-api-key'
import {
  parseProjectApiKey,
  parseProjectApiKeyWithSecret,
  type RawProjectApiKey,
  type RawProjectApiKeyWithSecret,
} from './project-api-key-mapper'

/**
 * `partner.projects.apiKeys.*` — issue, rotate and revoke the API key of a
 * customer's project. Needs the `api_keys:write` scope, which a new partner
 * key does not have by default. Orchestrates `http` — no transport logic of
 * its own.
 *
 * **These calls are not idempotent.** The API ignores `Idempotency-Key` on
 * them, and the transport retries a request whose response never arrived: a
 * lost `create` response can leave two keys issued, and a lost `rotate`
 * response can rotate twice, leaving you holding a secret that is already
 * replaced. Build the client with `maxRetries: 0` for these calls if that
 * matters more than riding out a network failure.
 */
export class ProjectApiKeysResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Issues the key a customer's traffic is sent with. The secret comes back
   * **once**. The partner key itself never sends a message — this key does.
   */
  async create(
    projectId: PartnerProjectId,
    params: CreateProjectApiKeyParams
  ): Promise<ProjectApiKeyWithSecret> {
    const raw = await this.http.request<RawProjectApiKeyWithSecret>({
      method: 'POST',
      path: `/v1/partner/projects/${projectId}/api_keys`,
      body: serializeCreateProjectApiKeyParams(params),
    })
    return parseProjectApiKeyWithSecret(raw)
  }

  /**
   * Issues a replacement with the same scopes, expiry and IP allowlist, and
   * returns its secret, once. The original keeps working until you
   * `revoke()` it, so you can switch traffic over before cutting it off. See
   * the note on this class about retries.
   */
  async rotate(
    projectId: PartnerProjectId,
    keyId: ApiKeyId
  ): Promise<ProjectApiKeyWithSecret> {
    const raw = await this.http.request<RawProjectApiKeyWithSecret>({
      method: 'POST',
      path: `/v1/partner/projects/${projectId}/api_keys/${keyId}/rotate`,
    })
    return parseProjectApiKeyWithSecret(raw)
  }

  /** Revokes a key for good. */
  async revoke(
    projectId: PartnerProjectId,
    keyId: ApiKeyId
  ): Promise<ProjectApiKey> {
    const raw = await this.http.request<RawProjectApiKey>({
      method: 'POST',
      path: `/v1/partner/projects/${projectId}/api_keys/${keyId}/revoke`,
    })
    return parseProjectApiKey(raw)
  }
}
