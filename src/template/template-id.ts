import { type Id, isPrefixedId, toId } from '../domain/branded-id'

const PREFIX = 'tmpl'

/** Uniquely identifies a Template resource. */
export type TemplateId = Id<typeof PREFIX>

/** Narrows `value` to a `TemplateId` if it has the expected shape. */
export function isTemplateId(value: string): value is TemplateId {
  return isPrefixedId(PREFIX, value)
}

/** Casts an already-trusted value (e.g. a parsed API response field) to a `TemplateId`. */
export function toTemplateId(value: string): TemplateId {
  return toId(value)
}
