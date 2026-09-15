import { type Id, isPrefixedId, toId } from '../domain/branded-id'

const PREFIX = 'evt'

/** Uniquely identifies an Event resource. */
export type EventId = Id<typeof PREFIX>

/** Narrows `value` to an `EventId` if it has the expected shape. */
export function isEventId(value: string): value is EventId {
  return isPrefixedId(PREFIX, value)
}

/** Casts an already-trusted value (e.g. a parsed API response field) to an `EventId`. */
export function toEventId(value: string): EventId {
  return toId(value)
}
