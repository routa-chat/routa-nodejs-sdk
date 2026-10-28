import type { Message, MessageContent, MessageStatus } from './message'
import { toMessageId } from './message-id'

/**
 * Wire shape of a message as returned by the API — snake_case timestamps, an
 * unparsed `content`. This is the one type the JSON body of a
 * `/v1/messages*` response is cast to before being turned into a `Message`.
 */
export interface RawMessage {
  readonly id: string
  readonly channel: string
  readonly direction: 'outbound' | 'inbound'
  readonly from: string
  readonly to: string
  readonly content: MessageContent | null
  readonly status: MessageStatus
  readonly metadata: Record<string, string>
  readonly accepted_at: string
  readonly sent_at: string | null
  readonly delivered_at: string | null
  readonly read_at: string | null
  readonly failed_at: string | null
  /** Absent from responses of an API version that predates plan retention. */
  readonly content_redacted_at?: string | null | undefined
}

/**
 * Turns a raw API message into the typed `Message` every `messages.*` method
 * returns. `replayed` is not part of the wire body — it comes from the
 * `Idempotent-Replay` response header, so only `messages.send()` (the one
 * call site where replay is possible) ever passes anything but the default.
 */
export function parseMessage(raw: RawMessage, replayed = false): Message {
  return {
    id: toMessageId(raw.id),
    channel: raw.channel,
    direction: raw.direction,
    from: raw.from,
    to: raw.to,
    content: raw.content === null ? null : parseMessageContent(raw.content),
    status: raw.status,
    metadata: raw.metadata,
    acceptedAt: raw.accepted_at,
    sentAt: raw.sent_at,
    deliveredAt: raw.delivered_at,
    readAt: raw.read_at,
    failedAt: raw.failed_at,
    contentRedactedAt: raw.content_redacted_at ?? null,
    _replayed: replayed,
  }
}

/**
 * Validates that a message's `content` is one of the known types before
 * treating it as a `MessageContent` — the one place a `content` value from
 * an HTTP response is trusted without further checks. The exhaustive switch
 * means adding a new content type to the union without handling it here
 * fails the build instead of silently passing an unrecognized shape through.
 */
function parseMessageContent(content: MessageContent): MessageContent {
  switch (content.type) {
    case 'text':
    case 'image':
    case 'document':
    case 'audio':
    case 'video':
    case 'sticker':
    case 'location':
    case 'reaction':
    case 'template':
    case 'unsupported':
      return content
    default: {
      const exhaustiveCheck: never = content
      throw new Error(
        `Unknown message content type: ${JSON.stringify(exhaustiveCheck)}`
      )
    }
  }
}
