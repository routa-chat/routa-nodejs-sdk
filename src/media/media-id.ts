import { type Id, isPrefixedId, toId } from '../domain/branded-id'

const PREFIX = 'med'

/** Uniquely identifies a Media resource. */
export type MediaId = Id<typeof PREFIX>

/** Narrows `value` to a `MediaId` if it has the expected shape. */
export function isMediaId(value: string): value is MediaId {
  return isPrefixedId(PREFIX, value)
}

/** Casts an already-trusted value (e.g. a parsed API response field) to a `MediaId`. */
export function toMediaId(value: string): MediaId {
  return toId(value)
}
