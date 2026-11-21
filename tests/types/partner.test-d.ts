import { expectTypeOf, test } from 'vitest'
import { Routa } from '../../src/client'
import type { ChannelId } from '../../src/domain/channel-id'
import { toChannelId } from '../../src/domain/channel-id'
import type { Page, PageIterable } from '../../src/domain/pagination'
import {
  type ApiKeyId,
  type PartnerChannel,
  type PartnerConfig,
  type PartnerProject,
  type PartnerProjectDetail,
  type PartnerProjectId,
  type PartnerWebhookSetResult,
  type ProjectApiKey,
  type ProjectApiKeyWithSecret,
  type ProjectCreateResult,
  type ProjectDeleteResult,
  RoutaPartner,
  toApiKeyId,
  toPartnerProjectId,
} from '../../src/partner'
import type { Webhook, WebhookWithSecret } from '../../src/webhook/webhook'
import type { ApiKeyScope } from '../../src/whoami'

const partner = new RoutaPartner({ partnerKey: 'rt_partner_abc' })
const projectId = toPartnerProjectId('proj_01J8XA1B2C3D4E5F6G7H8J9K0M')
const keyId = toApiKeyId('key_01J8XA1B2C3D4E5F6G7H8J9K0M')
const channelId = toChannelId('chan_01J8XA1B2C3D4E5F6G7H8J9K0M')

test('RoutaPartner takes a partnerKey and never an apiKey', () => {
  void new RoutaPartner({ partnerKey: 'rt_partner_abc' })
  void new RoutaPartner({
    partnerKey: 'rt_partner_abc',
    baseURL: 'http://localhost:3000',
    timeout: 1000,
    maxRetries: 0,
  })

  // @ts-expect-error — `apiKey` is the project credential; the partner client has no such option.
  void new RoutaPartner({ apiKey: 'rt_live_abc' })
  // @ts-expect-error — `partnerKey` is required, and `apiKey` does not stand in for it.
  void new RoutaPartner({ apiKey: 'rt_partner_abc' })
  // @ts-expect-error — both at once is not accepted either.
  void new RoutaPartner({ partnerKey: 'rt_partner_abc', apiKey: 'rt_live_abc' })
  // the string shorthand mirrors `new Routa(apiKey)`; it is the same `partnerKey`.
  void new RoutaPartner('rt_partner_abc')
  // @ts-expect-error — the shorthand takes a string, nothing else.
  void new RoutaPartner(42)
  // @ts-expect-error — an empty config has no credential.
  void new RoutaPartner({})
})

test('Routa does not take a partnerKey', () => {
  // @ts-expect-error — `partnerKey` belongs to `RoutaPartner`.
  void new Routa({ partnerKey: 'rt_partner_abc' })
  // @ts-expect-error — and it does not stand in for `apiKey`.
  void new Routa({ apiKey: 'rt_live_abc', partnerKey: 'rt_partner_abc' })
})

test('PartnerConfig and RoutaConfig share the transport options but not the credential', () => {
  expectTypeOf<PartnerConfig>().toHaveProperty('partnerKey')
  expectTypeOf<PartnerConfig>().not.toHaveProperty('apiKey')
  expectTypeOf<PartnerConfig['baseURL']>().toEqualTypeOf<string | undefined>()
})

test('ProjectDeleteResult is an exhaustive union on status', () => {
  expectTypeOf<ProjectDeleteResult['status']>().toEqualTypeOf<
    'deleted' | 'deleting'
  >()

  function handle(result: ProjectDeleteResult): string {
    switch (result.status) {
      case 'deleted':
        // @ts-expect-error — a `deleted` result carries no projectId.
        void result.projectId
        return 'gone'
      case 'deleting':
        expectTypeOf(result.projectId).toEqualTypeOf<PartnerProjectId>()
        return result.projectId
      default: {
        const exhaustive: never = result
        return exhaustive
      }
    }
  }
  void handle
})

test('a switch that forgets a ProjectDeleteResult case does not compile', () => {
  function incomplete(result: ProjectDeleteResult): string {
    switch (result.status) {
      case 'deleted':
        return 'gone'
      default: {
        // @ts-expect-error — `deleting` is not handled, so `result` is not `never`.
        const exhaustive: never = result
        return exhaustive
      }
    }
  }
  void incomplete
})

test('ids are branded: PartnerProjectId, ApiKeyId and ChannelId do not mix', () => {
  expectTypeOf(projectId).toEqualTypeOf<PartnerProjectId>()
  expectTypeOf(keyId).toEqualTypeOf<ApiKeyId>()
  expectTypeOf(projectId).not.toEqualTypeOf<ApiKeyId>()
  expectTypeOf(keyId).not.toEqualTypeOf<ChannelId>()
  expectTypeOf(projectId).not.toEqualTypeOf<ChannelId>()

  // @ts-expect-error — a ChannelId is not a PartnerProjectId.
  void partner.projects.retrieve(channelId)
  // @ts-expect-error — a bare string is not a PartnerProjectId.
  void partner.projects.retrieve('proj_01J8XA1B2C3D4E5F6G7H8J9K0M')
  // @ts-expect-error — an ApiKeyId is not a PartnerProjectId.
  void partner.projects.delete(keyId)
  // @ts-expect-error — arguments in the wrong order.
  void partner.projects.apiKeys.rotate(keyId, projectId)
  // @ts-expect-error — the channel to delete is a ChannelId, not a project id.
  void partner.channels.delete(projectId, projectId)
})

test('projects: create needs both name and externalRef; update accepts only name', () => {
  void partner.projects.create({ name: 'Loja', externalRef: 'lead_1' })
  // @ts-expect-error — `externalRef` is required.
  void partner.projects.create({ name: 'Loja' })
  // @ts-expect-error — `name` is required.
  void partner.projects.create({ externalRef: 'lead_1' })

  void partner.projects.update(projectId, { name: 'Novo' })
  // @ts-expect-error — `externalRef` is immutable and not an option of `update()`.
  void partner.projects.update(projectId, { name: 'Novo', externalRef: 'x' })

  expectTypeOf(
    partner.projects.create
  ).returns.resolves.toEqualTypeOf<ProjectCreateResult>()
  expectTypeOf<ProjectCreateResult['created']>().toEqualTypeOf<boolean>()
  expectTypeOf(
    partner.projects.retrieve
  ).returns.resolves.toEqualTypeOf<PartnerProjectDetail>()
  expectTypeOf(
    partner.projects.update
  ).returns.resolves.toEqualTypeOf<PartnerProject>()
  expectTypeOf(
    partner.projects.delete
  ).returns.resolves.toEqualTypeOf<ProjectDeleteResult>()
})

test('lists are cursor-paginated and iterable', () => {
  expectTypeOf(partner.projects.list()).toEqualTypeOf<
    PageIterable<PartnerProject>
  >()
  expectTypeOf(partner.channels.list()).toEqualTypeOf<
    PageIterable<PartnerChannel>
  >()
  expectTypeOf(partner.projects.list().page()).resolves.toEqualTypeOf<
    Page<PartnerProject>
  >()
  void partner.projects.list({ externalRef: 'x', hasChannel: false, limit: 5 })
  // @ts-expect-error — `hasChannel` is a boolean, not the query-string spelling.
  void partner.projects.list({ hasChannel: 'true' })
  void partner.channels.list({
    status: 'disabled',
    projectId,
    externalRef: 'x',
  })
  // @ts-expect-error — not a channel status.
  void partner.channels.list({ status: 'enabled' })
  // @ts-expect-error — `projectId` is a PartnerProjectId.
  void partner.channels.list({ projectId: 'proj_01J8XA1B2C3D4E5F6G7H8J9K0M' })
})

test('a channel is a closed set of states and reasons', () => {
  expectTypeOf<PartnerChannel['status']>().toEqualTypeOf<
    'pending' | 'active' | 'degraded' | 'disabled'
  >()
  expectTypeOf<PartnerChannel['statusReasonCode']>().toEqualTypeOf<
    | 'provider_auth_repeated_failure'
    | 'disconnected_by_customer'
    | 'offboarded'
    | null
  >()
  expectTypeOf<PartnerChannel['connectionMode']>().toEqualTypeOf<
    'cloud_api' | 'coexistence'
  >()
  expectTypeOf<PartnerChannel['disconnectionReason']>().toEqualTypeOf<
    | 'account_disconnected'
    | 'business_downgrade'
    | 'change_number'
    | 'companion_inactivity'
    | 'primary_inactivity'
    | 'user_re_registered'
    | 'unknown'
    | null
  >()
  expectTypeOf<PartnerChannel['id']>().toEqualTypeOf<ChannelId>()
  expectTypeOf<PartnerChannel['projectId']>().toEqualTypeOf<PartnerProjectId>()
})

test('API keys: the secret is only on the type that mints it, and scopes are the shared ApiKeyScope', () => {
  expectTypeOf<ProjectApiKey>().not.toHaveProperty('secret')
  expectTypeOf<ProjectApiKeyWithSecret['secret']>().toEqualTypeOf<string>()
  expectTypeOf<ProjectApiKey['scopes']>().toEqualTypeOf<
    readonly ApiKeyScope[]
  >()
  expectTypeOf(
    partner.projects.apiKeys.create
  ).returns.resolves.toEqualTypeOf<ProjectApiKeyWithSecret>()
  expectTypeOf(
    partner.projects.apiKeys.rotate
  ).returns.resolves.toEqualTypeOf<ProjectApiKeyWithSecret>()
  expectTypeOf(
    partner.projects.apiKeys.revoke
  ).returns.resolves.toEqualTypeOf<ProjectApiKey>()

  void partner.projects.apiKeys.create(projectId, {
    scopes: ['messages:write'],
  })
  void partner.projects.apiKeys.create(projectId, {
    // @ts-expect-error — not a scope.
    scopes: ['messages:delete'],
  })
  // @ts-expect-error — `scopes` is required.
  void partner.projects.apiKeys.create(projectId, { name: 'x' })
})

test('webhook: set may or may not return a secret; rotateSecret always does', () => {
  expectTypeOf<PartnerWebhookSetResult['webhook']>().toEqualTypeOf<Webhook>()
  expectTypeOf<PartnerWebhookSetResult['secret']>().toEqualTypeOf<
    string | undefined
  >()
  expectTypeOf(
    partner.webhook.retrieve
  ).returns.resolves.toEqualTypeOf<Webhook>()
  expectTypeOf(
    partner.webhook.rotateSecret
  ).returns.resolves.toEqualTypeOf<WebhookWithSecret>()
  expectTypeOf(
    partner.webhook.set
  ).returns.resolves.toEqualTypeOf<PartnerWebhookSetResult>()
  // @ts-expect-error — `url` and `subscribedTypes` are required.
  void partner.webhook.set({ url: 'https://x.example' })
})
