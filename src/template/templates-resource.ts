import type { Page } from '../domain/pagination'
import type { HttpClient } from '../http/http-client'
import type { ListTemplatesParams, RawTemplatePage } from './list-templates'
import {
  type SubmitTemplateParams,
  serializeSubmitTemplateParams,
} from './submit-template'
import type { Template } from './template'
import type { TemplateId } from './template-id'
import { parseTemplate, type RawTemplate } from './template-mapper'

/** `routa.templates.*` — submit, read, and list templates. Orchestrates `http` — no transport logic of its own. */
export class TemplatesResource {
  constructor(private readonly http: HttpClient) {}

  async submit(params: SubmitTemplateParams): Promise<Template> {
    const raw = await this.http.request<RawTemplate>({
      method: 'POST',
      path: '/v1/templates',
      body: serializeSubmitTemplateParams(params),
    })
    return parseTemplate(raw)
  }

  async retrieve(id: TemplateId): Promise<Template> {
    const raw = await this.http.request<RawTemplate>({
      method: 'GET',
      path: `/v1/templates/${id}`,
    })
    return parseTemplate(raw)
  }

  list(
    params: ListTemplatesParams = {}
  ): AsyncIterable<Template> & { page(): Promise<Page<Template>> } {
    const fetchPage = (cursor: string | undefined): Promise<Page<Template>> =>
      this.fetchTemplatesPage(params, cursor)

    return {
      page: () => fetchPage(params.cursor),
      [Symbol.asyncIterator]: (): AsyncIterator<Template> => {
        let cursor = params.cursor
        let exhausted = false
        const queue: Template[] = []

        return {
          async next(): Promise<IteratorResult<Template>> {
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

  private async fetchTemplatesPage(
    params: ListTemplatesParams,
    cursor: string | undefined
  ): Promise<Page<Template>> {
    const searchParams: Record<string, string> = {}
    if (params.channel !== undefined) {
      searchParams['channel'] = params.channel
    }
    if (params.limit !== undefined) {
      searchParams['limit'] = String(params.limit)
    }
    if (cursor !== undefined) {
      searchParams['cursor'] = cursor
    }

    const raw = await this.http.request<RawTemplatePage>({
      method: 'GET',
      path: '/v1/templates',
      searchParams,
    })

    return {
      data: raw.data.map(parseTemplate),
      hasMore: raw.has_more,
      nextCursor: raw.next_cursor,
    }
  }
}
