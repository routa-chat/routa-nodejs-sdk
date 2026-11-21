import { toChannelId } from '../../domain/channel-id'
import type {
  PartnerProject,
  PartnerProjectDetail,
  PartnerProjectEnvironment,
} from './partner-project'
import { toPartnerProjectId } from './partner-project-id'

/** Wire shape of a partner project as returned by the API. */
export interface RawPartnerProject {
  readonly id: string
  readonly name: string
  readonly external_ref: string
  readonly environment: PartnerProjectEnvironment
  readonly created_at: string
}

/** Wire shape of `GET /v1/partner/projects/{projectId}`. */
export interface RawPartnerProjectDetail extends RawPartnerProject {
  readonly channels: readonly { readonly id: string; readonly status: string }[]
}

/** Wire shape of a `GET /v1/partner/projects` page, before its items are parsed into `PartnerProject`. */
export interface RawPartnerProjectPage {
  readonly data: readonly RawPartnerProject[]
  readonly has_more: boolean
  readonly next_cursor: string | null
}

/** Wire shape of the `202` answer of `DELETE /v1/partner/projects/{projectId}`. */
export interface RawPartnerProjectDeleting {
  readonly project_id: string
  readonly status: 'deleting'
}

export function parsePartnerProject(raw: RawPartnerProject): PartnerProject {
  return {
    id: toPartnerProjectId(raw.id),
    name: raw.name,
    externalRef: raw.external_ref,
    environment: raw.environment,
    createdAt: raw.created_at,
  }
}

export function parsePartnerProjectDetail(
  raw: RawPartnerProjectDetail
): PartnerProjectDetail {
  return {
    ...parsePartnerProject(raw),
    channels: raw.channels.map(channel => ({
      id: toChannelId(channel.id),
      status: channel.status,
    })),
  }
}
