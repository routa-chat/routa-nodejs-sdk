/**
 * The `error.details` object of an API error response: machine-readable
 * values a caller can act on (a quota's `limit`, a conflict's `reason`).
 * Present only on the errors that define them, and the names differ per
 * error code, so each subclass reads the few keys it documents.
 */
export type RoutaErrorDetailValues = Readonly<Record<string, string | number>>

/** The numeric `details` entry under `key`, or `undefined` when absent or not a number. */
export function readNumberDetail(
  details: RoutaErrorDetailValues | undefined,
  key: string
): number | undefined {
  const value = details?.[key]
  return typeof value === 'number' ? value : undefined
}

/** The string `details` entry under `key`, or `undefined` when absent or not a string. */
export function readStringDetail(
  details: RoutaErrorDetailValues | undefined,
  key: string
): string | undefined {
  const value = details?.[key]
  return typeof value === 'string' ? value : undefined
}
