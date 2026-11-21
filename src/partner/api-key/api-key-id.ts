import { type Id, isPrefixedId, toId } from '../../domain/branded-id'

const PREFIX = 'key'

/** Uniquely identifies an API key. */
export type ApiKeyId = Id<typeof PREFIX>

/** Narrows `value` to an `ApiKeyId` if it has the expected shape. */
export function isApiKeyId(value: string): value is ApiKeyId {
  return isPrefixedId(PREFIX, value)
}

/** Casts an already-trusted value (e.g. a parsed API response field) to an `ApiKeyId`. */
export function toApiKeyId(value: string): ApiKeyId {
  return toId(value)
}
