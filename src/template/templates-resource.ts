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
import type { TemplateMedia } from './template-media'
import {
  parseTemplateMedia,
  type RawTemplateMedia,
} from './template-media-mapper'
import type { UploadTemplateMediaParams } from './upload-template-media'

/** `routa.templates.*` — submit, read, and list templates, and upload header media. Orchestrates `http` — no transport logic of its own. */
export class TemplatesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Submits a template for WhatsApp review (`POST /v1/templates`, API key scope
   * `templates:write`) and returns it as Routa recorded it. Pass `components`
   * for a header, a footer and up to 10 buttons; leave it out for a body-only
   * template.
   *
   * ```ts
   * const media = await routa.templates.uploadMedia({ file: bytes, contentType: 'image/png' })
   * const template = await routa.templates.submit({
   *   channel: 'chan_…',
   *   name: 'order_shipped',
   *   language: 'en_US',
   *   category: 'utility',
   *   bodyText: 'Your order {{1}} shipped.',
   *   components: {
   *     header: { kind: 'media', mediaId: media.id },
   *     footer: { text: 'Reply STOP to opt out' },
   *     buttons: [{ kind: 'url', text: 'Track', url: 'https://example.com/track/{{1}}' }],
   *   },
   * })
   * ```
   *
   * **The answer is `201` with `status: 'submitted'`, not `approved`.** The
   * template is recorded first and sent to WhatsApp afterwards, and WhatsApp
   * decides later: follow `template.*` events (webhooks or `events`) for
   * `pending`, `approved`, `rejected` or `failed`. A `failed` template (see
   * `failureCode`) cannot be corrected through this SDK — editing, deleting
   * and syncing templates have no API-key route yet.
   *
   * **No client-side checks beyond the shape.** The SDK does not validate the
   * name, the body, lengths, the number of buttons, URL or phone formats or
   * WhatsApp's rules: the API is the source of truth, and a rule copied here
   * would drift from it. A refused request throws:
   *
   * - `RoutaInvalidRequestError` (`422`):
   *   - `template_name_invalid` — `param` is `name`.
   *   - `template_components_invalid` — `param` names the component, not the
   *     item: `body_text`, `components.header`, `components.footer` or
   *     `components.buttons`. There is no index or sub-field (nothing like
   *     `components.buttons.0.url`); the `message` says what is wrong. The API
   *     reports the first problem it finds, so fixing one may reveal the next.
   *   - `template_variables_invalid` and `capability_unsupported` (the channel
   *     cannot send templates) — no `param`.
   * - `RoutaInvalidRequestError` (`404`) with `template_media_not_found` when a
   *   header's `mediaId` does not exist **in this project** (another project's
   *   media looks the same), or `channel_not_found`. The API checks the
   *   channel before it looks at the media, so an unknown channel hides a bad
   *   `mediaId`. Neither sets `param`.
   * - `RoutaInvalidRequestError` `403 insufficient_scope` if the key lacks
   *   `templates:write`.
   *
   * **Not idempotent.** `POST /v1/templates` does not read `Idempotency-Key`,
   * so the SDK sends none, and Routa does not require a template name to be
   * unique when it records a submission. The client still retries a network
   * failure or a `5xx` up to `maxRetries` times; if the first attempt had
   * already been recorded and only the response was lost, the retry records a
   * second template (a new `tmpl_…`) with the same name, which WhatsApp may
   * refuse as a duplicate. Set `maxRetries: 0` on the client if a duplicate
   * matters more than resilience to a flaky connection, and `list()` before
   * submitting again after an error you could not read.
   */
  async submit(params: SubmitTemplateParams): Promise<Template> {
    const raw = await this.http.request<RawTemplate>({
      method: 'POST',
      path: '/v1/templates',
      body: serializeSubmitTemplateParams(params),
    })
    return parseTemplate(raw)
  }

  /**
   * Stores a file to use as a template's header image, video or document
   * (`POST /v1/templates/media`, API key scope `templates:write`) and returns
   * its `TemplateMedia`. Pass the `id` as `mediaId` in a `media` header of
   * `submit()`:
   *
   * ```ts
   * const media = await routa.templates.uploadMedia({
   *   file: await readFile('./header.png'), // a Uint8Array (a Buffer is one) or a Blob
   *   contentType: 'image/png',
   * })
   * ```
   *
   * The upload is synchronous: the `TemplateMedia` is usable at once. Its
   * `format` is derived by the API from `contentType` — `image` for
   * `image/jpeg` and `image/png` (up to 5 MiB), `video` for `video/mp4` (up to
   * 16 MiB), `document` for `application/pdf` (up to 100 MiB). It is not a
   * `Media`: it belongs to the project, only a template header can use it, and
   * `messages.send()` cannot.
   *
   * **No client-side checks.** The SDK checks neither the size nor the type
   * of `file`, and unlike `media.upload()` there is no `sourceUrl` mode. A
   * rejected upload throws:
   *
   * - `RoutaInvalidRequestError` (`422`) with `code` `template_media_invalid`
   *   for every cause — an unsupported `contentType`, first bytes that do not
   *   match it, or a file over its type's cap. The `message` says which; there
   *   is no `param`. `contentType` is matched exactly, so `image/png;
   *   charset=binary` is rejected.
   * - `RoutaApiError` (a base one) with `statusCode` `413` and `code`
   *   `payload_too_large` when the declared body exceeds 100 MiB. Not retried.
   * - `RoutaInvalidRequestError` `403 insufficient_scope` if the key lacks
   *   `templates:write`.
   *
   * **Not idempotent.** `POST /v1/templates/media` does not read
   * `Idempotency-Key`, so the SDK sends none. The client still retries a
   * network failure or a `5xx` up to `maxRetries` times; if the first attempt
   * had already stored the file and only the response was lost, the retry
   * stores a second copy under a new `id`. Set `maxRetries: 0` on the client
   * if a duplicate matters more than resilience to a flaky connection.
   */
  async uploadMedia(params: UploadTemplateMediaParams): Promise<TemplateMedia> {
    const raw = await this.http.request<RawTemplateMedia>({
      method: 'POST',
      path: '/v1/templates/media',
      rawBody: { data: params.file, contentType: params.contentType },
    })
    return parseTemplateMedia(raw)
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
