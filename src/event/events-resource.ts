import type { Page } from '../domain/pagination'
import type { HttpClient } from '../http/http-client'
import type { RoutaEvent } from './event'
import { parseEvent } from './event-mapper'
import type { ListEventsParams, RawEventPage } from './list-events'

/** `routa.events.*` — the reconciliation path for a consumer that missed webhook deliveries. Orchestrates `http` — no transport logic of its own. */
export class EventsResource {
  constructor(private readonly http: HttpClient) {}

  list(
    params: ListEventsParams = {}
  ): AsyncIterable<RoutaEvent> & { page(): Promise<Page<RoutaEvent>> } {
    const fetchPage = (after: string | undefined): Promise<Page<RoutaEvent>> =>
      this.fetchEventsPage(params, after)

    return {
      page: () => fetchPage(params.after),
      [Symbol.asyncIterator]: (): AsyncIterator<RoutaEvent> => {
        let after = params.after
        let exhausted = false
        const queue: RoutaEvent[] = []

        return {
          async next(): Promise<IteratorResult<RoutaEvent>> {
            while (queue.length === 0 && !exhausted) {
              const page = await fetchPage(after)
              queue.push(...page.data)
              if (page.hasMore && page.nextCursor !== null) {
                after = page.nextCursor
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

  private async fetchEventsPage(
    params: ListEventsParams,
    after: string | undefined
  ): Promise<Page<RoutaEvent>> {
    const searchParams: Record<string, string> = {}
    if (params.type !== undefined) {
      searchParams['type'] = params.type
    }
    if (params.limit !== undefined) {
      searchParams['limit'] = String(params.limit)
    }
    if (after !== undefined) {
      searchParams['after'] = after
    }

    const raw = await this.http.request<RawEventPage>({
      method: 'GET',
      path: '/v1/events',
      searchParams,
    })

    return {
      data: raw.data.map(parseEvent),
      hasMore: raw.has_more,
      nextCursor: raw.next_cursor,
    }
  }
}
