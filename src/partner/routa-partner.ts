import { createHttpClient, type HttpClient } from '../http/http-client'
import { PartnerChannelsResource } from './channel/partner-channels-resource'
import {
  type PartnerConfig,
  type PartnerConfigInput,
  resolvePartnerConfig,
} from './partner-config'
import { ProjectsResource } from './project/projects-resource'
import { PartnerWebhookResource } from './webhook/partner-webhook-resource'

/**
 * Client of the Partner API: the calls a platform that resells WhatsApp makes
 * to provision its customers — one project per customer, tied to the
 * partner's own id for them by `externalRef`.
 *
 * **Experimental.** The Partner API is recent and exists only for plans that
 * include it, so this entry point may change in a minor release until an
 * external partner has used it.
 *
 * ```ts
 * import { RoutaPartner } from '@routa-chat/sdk/partner'
 *
 * const partner = new RoutaPartner('rt_partner_…')
 * // or, to set other options: new RoutaPartner({ partnerKey, timeout: 10_000 })
 * const { project } = await partner.projects.create({
 *   name: 'Loja do Zé',
 *   externalRef: 'lead_123',
 * })
 * ```
 *
 * A partner key **never sends a message**: after onboarding, a customer's
 * traffic uses that project's API key with `Routa`. It is accepted only by
 * `/v1/partner/*`, and a project API key is refused there with `401`.
 *
 * Errors are the same classes `Routa` throws, imported from the package root
 * (`error instanceof RoutaApiError` holds). Worth knowing:
 *
 * - `404 partner_api_not_available` (`RoutaInvalidRequestError`) on any call:
 *   the organization's plan does not carry the Partner API (or has lapsed).
 *   A partner key is issued in the dashboard, and the plan's `partnerApi`
 *   capability is granted by Routa — it is not something this client can fix.
 * - `403` (`RoutaInvalidRequestError`): the key lacks the scope the call
 *   needs. `api_keys:write`, `webhooks:write`, `channels:write` and
 *   `projects:delete` are opt-in; a new key has only `projects:read` and
 *   `projects:write`.
 * - `402 project_limit_exceeded` (`RoutaBillingError`) when creating a
 *   project above the plan's limit.
 * - `429` (`RoutaRateLimitError`): the limit is per organization — one
 *   bucket for all of `/v1/partner/*`.
 *
 * None of the `/v1/partner/*` routes use `Idempotency-Key`; creating a
 * project is idempotent by `externalRef` instead.
 */
export class RoutaPartner {
  /** The transport every resource namespace is built on top of. */
  protected readonly httpClient: HttpClient

  readonly projects: ProjectsResource
  readonly channels: PartnerChannelsResource
  readonly webhook: PartnerWebhookResource

  /** `new RoutaPartner({ partnerKey, ... })` — full configuration. */
  constructor(config: PartnerConfig)
  /** `new RoutaPartner(partnerKey)` — shorthand for `new RoutaPartner({ partnerKey })`, for the common case where no other option is needed. */
  constructor(partnerKey: string)
  constructor(input: PartnerConfigInput) {
    this.httpClient = createHttpClient(resolvePartnerConfig(input))
    this.projects = new ProjectsResource(this.httpClient)
    this.channels = new PartnerChannelsResource(this.httpClient)
    this.webhook = new PartnerWebhookResource(this.httpClient)
  }
}
