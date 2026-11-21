import type { PartnerProjectId } from '../project/partner-project-id'
import type { PartnerChannelStatus } from './partner-channel'

/** Filters accepted by `channels.list()` — mirrors the query params of `GET /v1/partner/channels`. They combine; a project or reference nobody holds is an empty page, not an error. */
export interface ListPartnerChannelsParams {
  readonly status?: PartnerChannelStatus
  readonly projectId?: PartnerProjectId
  readonly externalRef?: string
  /** Max items per page (1-200, 50 by default). */
  readonly limit?: number
  readonly cursor?: string
}

export function serializeListPartnerChannelsParams(
  params: ListPartnerChannelsParams,
  cursor: string | undefined
): Record<string, string> {
  const searchParams: Record<string, string> = {}
  if (params.status !== undefined) {
    searchParams['status'] = params.status
  }
  if (params.projectId !== undefined) {
    searchParams['project_id'] = params.projectId
  }
  if (params.externalRef !== undefined) {
    searchParams['external_ref'] = params.externalRef
  }
  if (params.limit !== undefined) {
    searchParams['limit'] = String(params.limit)
  }
  if (cursor !== undefined) {
    searchParams['cursor'] = cursor
  }
  return searchParams
}
