import { type Id, isPrefixedId, toId } from '../domain/branded-id'

const PREFIX = 'tmedia'

/** Uniquely identifies a template header media file (`POST /v1/templates/media`) — distinct from a `MediaId`. */
export type TemplateMediaId = Id<typeof PREFIX>

/** Narrows `value` to a `TemplateMediaId` if it has the expected shape. */
export function isTemplateMediaId(value: string): value is TemplateMediaId {
  return isPrefixedId(PREFIX, value)
}

/** Casts an already-trusted value (e.g. a parsed API response field) to a `TemplateMediaId`. */
export function toTemplateMediaId(value: string): TemplateMediaId {
  return toId(value)
}
