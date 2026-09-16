import type { Page } from '../domain/pagination'
import type { HttpClient } from '../http/http-client'
import type { ListMessagesParams, RawMessagePage } from './list-messages'
import type { Message } from './message'
import type { MessageId } from './message-id'
import { parseMessage, type RawMessage } from './message-mapper'
import {
  type SendMessageParams,
  serializeSendMessageParams,
} from './send-message'

/** `routa.messages.*` — send, read, and list messages. Orchestrates `http` — no transport logic of its own. */
export class MessagesResource {
  constructor(private readonly http: HttpClient) {}

  async send(params: SendMessageParams): Promise<Message> {
    const { data: raw, headers } =
      await this.http.requestWithHeaders<RawMessage>({
        method: 'POST',
        path: '/v1/messages',
        body: serializeSendMessageParams(params),
        idempotencyKeyEligible: true,
        ...(params.idempotencyKey !== undefined
          ? { idempotencyKey: params.idempotencyKey }
          : {}),
      })
    return parseMessage(raw, headers.get('Idempotent-Replay') === 'true')
  }

  async retrieve(id: MessageId): Promise<Message> {
    const raw = await this.http.request<RawMessage>({
      method: 'GET',
      path: `/v1/messages/${id}`,
    })
    return parseMessage(raw)
  }

  async markRead(id: MessageId): Promise<Message> {
    const raw = await this.http.request<RawMessage>({
      method: 'POST',
      path: `/v1/messages/${id}/read`,
    })
    return parseMessage(raw)
  }

  list(
    params: ListMessagesParams = {}
  ): AsyncIterable<Message> & { page(): Promise<Page<Message>> } {
    const fetchPage = (cursor: string | undefined): Promise<Page<Message>> =>
      this.fetchMessagesPage(params, cursor)

    return {
      page: () => fetchPage(params.cursor),
      [Symbol.asyncIterator]: (): AsyncIterator<Message> => {
        let cursor = params.cursor
        let exhausted = false
        const queue: Message[] = []

        return {
          async next(): Promise<IteratorResult<Message>> {
            while (queue.length === 0 && !exhausted) {
              const page = await fetchPage(cursor)
              queue.push(...page.data)
              if (page.hasMore && page.nextCursor !== null) {
                cursor = page.nextCursor
              } else {
                exhausted = true
              }
            }

            const value = queue.shift()
            if (value === undefined) {
              return { done: true, value: undefined }
            }
            return { done: false, value }
          },
        }
      },
    }
  }

  private async fetchMessagesPage(
    params: ListMessagesParams,
    cursor: string | undefined
  ): Promise<Page<Message>> {
    const searchParams: Record<string, string> = {}
    if (params.direction !== undefined) {
      searchParams['direction'] = params.direction
    }
    if (params.limit !== undefined) {
      searchParams['limit'] = String(params.limit)
    }
    if (cursor !== undefined) {
      searchParams['cursor'] = cursor
    }

    const raw = await this.http.request<RawMessagePage>({
      method: 'GET',
      path: '/v1/messages',
      searchParams,
    })

    return {
      data: raw.data.map(item => parseMessage(item)),
      hasMore: raw.has_more,
      nextCursor: raw.next_cursor,
    }
  }
}
