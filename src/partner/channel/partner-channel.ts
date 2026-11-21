import type { ChannelId } from '../../domain/channel-id'
import type { PartnerProjectId } from '../project/partner-project-id'

/** Where a customer's channel stands. `disabled` is the one that blocks deleting its project and holds its number. */
export type PartnerChannelStatus =
  | 'pending'
  | 'active'
  | 'degraded'
  | 'disabled'

/** Why a channel is `degraded` or `disabled` by the provider's doing; `null` otherwise. */
export type PartnerChannelStatusReasonCode =
  | 'provider_auth_repeated_failure'
  | 'disconnected_by_customer'
  | 'offboarded'

/** `cloud_api`: the number lives only on the Cloud API. `coexistence`: it stays in the WhatsApp Business app too. */
export type PartnerChannelConnectionMode = 'cloud_api' | 'coexistence'

/** Why the provider disconnected a `disabled` channel, in Routa's words; `unknown` for a reason Routa has no word for. */
export type PartnerChannelDisconnectionReason =
  | 'account_disconnected'
  | 'business_downgrade'
  | 'change_number'
  | 'companion_inactivity'
  | 'primary_inactivity'
  | 'user_re_registered'
  | 'unknown'

/**
 * The number of a customer's project, in which state and why. Deliberately
 * small: no provider, credential or provider id, no capabilities.
 */
export interface PartnerChannel {
  readonly id: ChannelId
  readonly projectId: PartnerProjectId
  /** The partner's own id for the customer the project serves. */
  readonly externalRef: string
  /** The number, in E.164. */
  readonly address: string
  readonly status: PartnerChannelStatus
  readonly statusReasonCode: PartnerChannelStatusReasonCode | null
  readonly connectionMode: PartnerChannelConnectionMode
  readonly disconnectionReason: PartnerChannelDisconnectionReason | null
  readonly createdAt: string
}
