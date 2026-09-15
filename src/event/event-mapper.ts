import { isKnownEventType, type RoutaEvent } from './event'
import { toEventId } from './event-id'

/**
 * Wire shape of an event as returned by the API — snake_case timing fields,
 * an unparsed `data`. This is the one type the JSON body of a `GET
 * /v1/events` item (or a webhook delivery's body) is cast to before being
 * turned into a `RoutaEvent`. `type` is read as a plain `string`, not
 * `EventType` — the API may send a kind this SDK version does not know
 * about yet.
 */
export interface RawEvent {
  readonly id: string
  readonly type: string
  readonly api_version: string
  readonly schema_version: number
  readonly project_id: string
  readonly sequence: number
  readonly occurred_at: string
  readonly recorded_at: string
  readonly data: unknown
}

/**
 * Turns a raw API event into the typed `RoutaEvent` every `events.*` method
 * and `webhooks.constructEvent()` return. A `type` outside the known set
 * becomes the generic fallback member instead of failing — an unrecognized
 * event kind is expected forward-compatibility, not a parsing error.
 */
export function parseEvent(raw: RawEvent): RoutaEvent {
  if (!isKnownEventType(raw.type)) {
    return { type: raw.type, data: raw.data }
  }
  return {
    id: toEventId(raw.id),
    type: raw.type,
    apiVersion: raw.api_version,
    schemaVersion: raw.schema_version,
    projectId: raw.project_id,
    sequence: raw.sequence,
    occurredAt: raw.occurred_at,
    recordedAt: raw.recorded_at,
    data: raw.data,
  }
}
