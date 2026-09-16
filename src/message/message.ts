import type { MessageId } from './message-id'

/**
 * Where a message sits in its (monotonic, never-regressing) delivery
 * lifecycle: `accepted` → `sent` → `delivered` → `read`, with `failed`
 * reachable from any non-terminal state.
 */
export type MessageStatus =
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'

/**
 * Every shape a message's `content` can take. This union is deliberately
 * wider than what `messages.send()` accepts — it also covers content types
 * that only ever arrive on an inbound or historical message (media,
 * location, reaction) and the `unsupported` fallback for content this SDK
 * does not yet model, so reading a message never throws just because its
 * content type isn't sendable yet.
 */
export type MessageContent =
  | { readonly type: 'text'; readonly body: string }
  | {
      readonly type: 'image'
      readonly media_id: string
      readonly caption?: string
    }
  | {
      readonly type: 'document'
      readonly media_id: string
      readonly filename?: string
      readonly caption?: string
    }
  | { readonly type: 'audio'; readonly media_id: string }
  | {
      readonly type: 'video'
      readonly media_id: string
      readonly caption?: string
    }
  | { readonly type: 'sticker'; readonly media_id: string }
  | {
      readonly type: 'location'
      readonly latitude: number
      readonly longitude: number
      readonly name?: string
      readonly address?: string
    }
  | {
      readonly type: 'reaction'
      readonly target_message_id: string
      readonly emoji: string
    }
  | {
      readonly type: 'template'
      readonly template_id: string
      readonly body_parameters: readonly string[]
    }
  | { readonly type: 'unsupported' }

/** A message sent or received through a Routa channel. */
export interface Message {
  readonly id: MessageId
  readonly channel: string
  readonly direction: 'outbound' | 'inbound'
  readonly from: string
  readonly to: string
  readonly content: MessageContent
  readonly status: MessageStatus
  readonly metadata: Record<string, string>
  /** ISO 8601 — always present, set the moment Routa accepts the message. */
  readonly acceptedAt: string
  readonly sentAt: string | null
  readonly deliveredAt: string | null
  readonly readAt: string | null
  readonly failedAt: string | null
  /**
   * `true` when this call reused an `Idempotency-Key` from an earlier
   * attempt and got back that attempt's original result instead of creating
   * a new message — useful for metrics, never for business logic, since the
   * message itself is identical either way. Always `false` outside of
   * `messages.send()`, where replay does not apply.
   */
  readonly _replayed: boolean
}
