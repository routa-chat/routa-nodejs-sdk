import { type Id, isPrefixedId, toId } from '../../domain/branded-id'

const PREFIX = 'proj'

/** Uniquely identifies a project — the one `RoutaPartner` creates for each of its customers. */
export type PartnerProjectId = Id<typeof PREFIX>

/** Narrows `value` to a `PartnerProjectId` if it has the expected shape. */
export function isPartnerProjectId(value: string): value is PartnerProjectId {
  return isPrefixedId(PREFIX, value)
}

/** Casts an already-trusted value (e.g. a parsed API response field) to a `PartnerProjectId`. */
export function toPartnerProjectId(value: string): PartnerProjectId {
  return toId(value)
}
