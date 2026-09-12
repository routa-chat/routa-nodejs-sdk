/**
 * One page of a keyset-paginated list endpoint. Generic over the item type
 * so every resource's `list()` can reuse it instead of redefining its own
 * page shape.
 */
export interface Page<T> {
  readonly data: readonly T[]
  readonly hasMore: boolean
  readonly nextCursor: string | null
}
