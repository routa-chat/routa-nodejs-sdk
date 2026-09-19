import {
  type RoutaConfig,
  type RoutaConfigInput,
  resolveConfig,
} from './config'
import { EventsResource } from './event/events-resource'
import { createHttpClient, type HttpClient } from './http/http-client'
import { MediaResource } from './media/media-resource'
import { MessagesResource } from './message/messages-resource'
import { TemplatesResource } from './template/templates-resource'
import { UsageResource } from './usage-resource'
import { WebhooksResource } from './webhook/webhooks-resource'
import { type Whoami, whoami } from './whoami'

/**
 * Entry point of the SDK. Validates configuration synchronously and wires up
 * the transport every resource sends its requests through.
 */
export class Routa {
  /** The transport every resource namespace is built on top of. */
  protected readonly httpClient: HttpClient

  readonly messages: MessagesResource
  readonly events: EventsResource
  readonly media: MediaResource
  readonly webhooks: WebhooksResource
  readonly templates: TemplatesResource
  readonly usage: UsageResource

  /** `new Routa({ apiKey, ... })` — full configuration. */
  constructor(config: RoutaConfig)
  /** `new Routa(apiKey)` — shorthand for `new Routa({ apiKey })`, for the common case where no other option is needed. */
  constructor(apiKey: string)
  constructor(input: RoutaConfigInput) {
    const resolvedConfig = resolveConfig(input)
    this.httpClient = createHttpClient(resolvedConfig)
    this.messages = new MessagesResource(this.httpClient)
    this.events = new EventsResource(this.httpClient)
    this.media = new MediaResource(this.httpClient)
    this.webhooks = new WebhooksResource(this.httpClient)
    this.templates = new TemplatesResource(this.httpClient)
    this.usage = new UsageResource(this.httpClient)
  }

  /** Resolves the calling API key's identity and scopes — a single diagnostic operation, not a namespace. */
  whoami(): Promise<Whoami> {
    return whoami(this.httpClient)
  }
}
