import type { ChannelId } from '../../domain/channel-id'
import { type Page, type PageIterable, paginate } from '../../domain/pagination'
import type { HttpClient } from '../../http/http-client'
import type { PartnerProjectId } from '../project/partner-project-id'
import {
  type ListPartnerChannelsParams,
  serializeListPartnerChannelsParams,
} from './list-partner-channels'
import type { PartnerChannel } from './partner-channel'
import {
  parsePartnerChannel,
  type RawPartnerChannelPage,
} from './partner-channel-mapper'

/**
 * `partner.channels.*` — the numbers of the partner's customers. Orchestrates
 * `http` — no transport logic of its own.
 */
export class PartnerChannelsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists the channels of every project the partner made, of every status
   * (`pending`, `active`, `degraded` and `disabled`), each with the
   * `externalRef` of its project — "who has a number, who has a problem" in
   * one call. Needs `projects:read`.
   */
  list(params: ListPartnerChannelsParams = {}): PageIterable<PartnerChannel> {
    return paginate(
      cursor => this.fetchChannelsPage(params, cursor),
      params.cursor
    )
  }

  /**
   * Deletes a **disabled** channel, freeing its number (a customer who
   * disconnected in the WhatsApp Business app holds it until then). Removes
   * the channel, its credential and its templates; messages, usage and
   * events keep naming it; nothing is changed at the provider. Needs the
   * opt-in `channels:write` scope.
   *
   * @throws {RoutaConflictError} `channel_not_disabled` (`409`) for a channel in any other status.
   */
  async delete(
    projectId: PartnerProjectId,
    channelId: ChannelId
  ): Promise<void> {
    await this.http.request<undefined>({
      method: 'DELETE',
      path: `/v1/partner/projects/${projectId}/channels/${channelId}`,
    })
  }

  private async fetchChannelsPage(
    params: ListPartnerChannelsParams,
    cursor: string | undefined
  ): Promise<Page<PartnerChannel>> {
    const raw = await this.http.request<RawPartnerChannelPage>({
      method: 'GET',
      path: '/v1/partner/channels',
      searchParams: serializeListPartnerChannelsParams(params, cursor),
    })
    return {
      data: raw.data.map(parsePartnerChannel),
      hasMore: raw.has_more,
      nextCursor: raw.next_cursor,
    }
  }
}
