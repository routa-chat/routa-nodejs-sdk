import type { EventId } from './event-id'

const EVENT_TYPES = [
  'message.accepted',
  'message.sent',
  'message.delivered',
  'message.read',
  'message.failed',
  'message.received',
  'channel.status_changed',
  'template.submitted',
  'template.pending',
  'template.approved',
  'template.rejected',
  'template.paused',
  'template.disabled',
] as const

/**
 * Every kind of event Routa can record today. New kinds may ship at any
 * time — a `RoutaEvent` whose `type` falls outside this list still parses,
 * as the generic fallback member of that union, rather than failing.
 */
export type EventType = (typeof EVENT_TYPES)[number]

const KNOWN_EVENT_TYPES: ReadonlySet<string> = new Set(EVENT_TYPES)

/** Narrows `type` to `EventType` if it is one of the kinds this SDK version knows about. */
export function isKnownEventType(type: string): type is EventType {
  return KNOWN_EVENT_TYPES.has(type)
}

interface RoutaEventEnvelope {
  readonly id: EventId
  readonly apiVersion: string
  readonly schemaVersion: number
  readonly projectId: string
  readonly sequence: number
  readonly occurredAt: string
  readonly recordedAt: string
  readonly data: unknown
}

/**
 * A single fact Routa recorded, in the order it happened — returned by
 * `events.list()` and by `webhooks.constructEvent()` alike. `data`'s shape
 * depends on `type`; it is read as `unknown` here rather than a type
 * specific to each kind, since interpreting it belongs to whoever consumes
 * it, not to parsing the envelope.
 *
 * The final member is a catch-all for any `type` this SDK version does not
 * recognize yet — deserializing to it instead of throwing lets a caller
 * safely ignore event kinds introduced after they last upgraded. Because
 * that member's `type` is a plain `string` rather than a literal, a
 * `switch (event.type)` alone does not narrow `event`'s other fields —
 * check `'id' in event` first to get the full envelope's type.
 */
export type RoutaEvent =
  | (RoutaEventEnvelope & { readonly type: 'message.accepted' })
  | (RoutaEventEnvelope & { readonly type: 'message.sent' })
  | (RoutaEventEnvelope & { readonly type: 'message.delivered' })
  | (RoutaEventEnvelope & { readonly type: 'message.read' })
  | (RoutaEventEnvelope & { readonly type: 'message.failed' })
  | (RoutaEventEnvelope & { readonly type: 'message.received' })
  | (RoutaEventEnvelope & { readonly type: 'channel.status_changed' })
  | (RoutaEventEnvelope & { readonly type: 'template.submitted' })
  | (RoutaEventEnvelope & { readonly type: 'template.pending' })
  | (RoutaEventEnvelope & { readonly type: 'template.approved' })
  | (RoutaEventEnvelope & { readonly type: 'template.rejected' })
  | (RoutaEventEnvelope & { readonly type: 'template.paused' })
  | (RoutaEventEnvelope & { readonly type: 'template.disabled' })
  | { readonly type: string; readonly data: unknown }
