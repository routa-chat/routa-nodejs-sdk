declare const idBrand: unique symbol

/**
 * A string branded with the kind of resource it identifies.
 *
 * At runtime an `Id<'msg'>` is just a string. At compile time it is not
 * assignable to (or from) an `Id<'chan'>`, so passing a channel id where a
 * message id is expected fails to compile instead of failing at request
 * time with a 404.
 */
export type Id<Prefix extends string> = string & {
  readonly [idBrand]: Prefix
}

const CROCKFORD_BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const ID_SUFFIX_LENGTH = 26

const PREFIXED_ID_PATTERN = new RegExp(
  `^[a-z][a-z0-9]*_[${CROCKFORD_BASE32_ALPHABET}]{${ID_SUFFIX_LENGTH}}$`
)

/**
 * Casts a raw string into a branded id without validating its shape.
 *
 * Only safe when the value is already known to be well-formed — for
 * example, a field read straight out of a parsed API response. For any
 * value whose shape is not already guaranteed (user input, a URL
 * parameter), use `isPrefixedId` to validate before narrowing.
 */
export function toId<Prefix extends string>(value: string): Id<Prefix> {
  return value as Id<Prefix>
}

/**
 * Validates that `value` starts with `{prefix}_` and is followed by a
 * 26-character Crockford base32 suffix, narrowing it to `Id<Prefix>` when it
 * does. This is the one function in this module that turns an unverified
 * string into a trusted branded id.
 */
export function isPrefixedId<Prefix extends string>(
  prefix: Prefix,
  value: string
): value is Id<Prefix> {
  return value.startsWith(`${prefix}_`) && PREFIXED_ID_PATTERN.test(value)
}
