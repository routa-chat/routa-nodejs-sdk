import { type Id, isPrefixedId, toId } from './branded-id'

const PREFIX = 'chan'

/** Uniquely identifies a Channel resource. */
export type ChannelId = Id<typeof PREFIX>

/** Narrows `value` to a `ChannelId` if it has the expected shape. */
export function isChannelId(value: string): value is ChannelId {
  return isPrefixedId(PREFIX, value)
}

/** Casts an already-trusted value (e.g. a parsed API response field) to a `ChannelId`. */
export function toChannelId(value: string): ChannelId {
  return toId(value)
}
