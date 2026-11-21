/**
 * `@routa-chat/sdk/partner` — the Partner API client (**experimental**).
 *
 * A separate entry point on purpose: `RoutaPartner` carries a credential that
 * reaches every customer of the partner, so importing it should be a visible,
 * greppable act, and `Routa` (the package root) must not load any of it.
 */
export type { ApiKeyId } from './api-key/api-key-id'
export { isApiKeyId, toApiKeyId } from './api-key/api-key-id'
export type { CreateProjectApiKeyParams } from './api-key/create-project-api-key'
export type {
  ProjectApiKey,
  ProjectApiKeyWithSecret,
} from './api-key/project-api-key'
export { ProjectApiKeysResource } from './api-key/project-api-keys-resource'
export type { ListPartnerChannelsParams } from './channel/list-partner-channels'
export type {
  PartnerChannel,
  PartnerChannelConnectionMode,
  PartnerChannelDisconnectionReason,
  PartnerChannelStatus,
  PartnerChannelStatusReasonCode,
} from './channel/partner-channel'
export { PartnerChannelsResource } from './channel/partner-channels-resource'
export type { BuildOnboardingLinkParams } from './onboarding-link/build-onboarding-link'
export { buildOnboardingLink } from './onboarding-link/build-onboarding-link'
export type { PartnerConfig } from './partner-config'
export type {
  PartnerProject,
  PartnerProjectChannelSummary,
  PartnerProjectDetail,
  PartnerProjectEnvironment,
  ProjectCreateResult,
  ProjectDeleteResult,
} from './project/partner-project'
export type { PartnerProjectId } from './project/partner-project-id'
export {
  isPartnerProjectId,
  toPartnerProjectId,
} from './project/partner-project-id'
export type {
  CreateProjectParams,
  ListProjectsParams,
  UpdateProjectParams,
} from './project/project-params'
export { ProjectsResource } from './project/projects-resource'
export { RoutaPartner } from './routa-partner'
export { PartnerWebhookResource } from './webhook/partner-webhook-resource'
export type {
  PartnerWebhookSetResult,
  SetPartnerWebhookParams,
} from './webhook/set-partner-webhook'
