import { type Id, isPrefixedId, toId } from '../domain/branded-id'

const PREFIX = 'msg'

/** Uniquely identifies a Message resource. */
export type MessageId = Id<typeof PREFIX>

/** Narrows `value` to a `MessageId` if it has the expected shape. */
export function isMessageId(value: string): value is MessageId {
  return isPrefixedId(PREFIX, value)
}

/** Casts an already-trusted value (e.g. a parsed API response field) to a `MessageId`. */
export function toMessageId(value: string): MessageId {
  return toId(value)
}
