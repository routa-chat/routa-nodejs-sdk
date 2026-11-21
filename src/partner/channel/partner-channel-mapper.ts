import { toChannelId } from '../../domain/channel-id'
import { toPartnerProjectId } from '../project/partner-project-id'
import type {
  PartnerChannel,
  PartnerChannelConnectionMode,
  PartnerChannelDisconnectionReason,
  PartnerChannelStatus,
  PartnerChannelStatusReasonCode,
} from './partner-channel'

/** Wire shape of a partner channel as returned by the API. */
export interface RawPartnerChannel {
  readonly id: string
  readonly project_id: string
  readonly external_ref: string
  readonly address: string
  readonly status: PartnerChannelStatus
  readonly status_reason_code: PartnerChannelStatusReasonCode | null
  readonly connection_mode: PartnerChannelConnectionMode
  readonly disconnection_reason: PartnerChannelDisconnectionReason | null
  readonly created_at: string
}

/** Wire shape of a `GET /v1/partner/channels` page, before its items are parsed into `PartnerChannel`. */
export interface RawPartnerChannelPage {
  readonly data: readonly RawPartnerChannel[]
  readonly has_more: boolean
  readonly next_cursor: string | null
}

export function parsePartnerChannel(raw: RawPartnerChannel): PartnerChannel {
  return {
    id: toChannelId(raw.id),
    projectId: toPartnerProjectId(raw.project_id),
    externalRef: raw.external_ref,
    address: raw.address,
    status: raw.status,
    statusReasonCode: raw.status_reason_code,
    connectionMode: raw.connection_mode,
    disconnectionReason: raw.disconnection_reason,
    createdAt: raw.created_at,
  }
}
