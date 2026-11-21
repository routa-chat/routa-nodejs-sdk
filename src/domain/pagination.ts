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

/**
 * What a cursor-paginated `list()` returns: `for await` walks every item
 * across pages, `.page()` fetches just one (with `hasMore` and `nextCursor`,
 * for a caller that paginates by hand).
 */
export type PageIterable<T> = AsyncIterable<T> & {
  page(): Promise<Page<T>>
}

/**
 * Builds a `PageIterable` from a function that fetches one page given a
 * cursor, starting at `startCursor`. Each iteration starts over from
 * `startCursor`, so the same result can be walked more than once.
 */
export function paginate<T>(
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
  startCursor: string | undefined
): PageIterable<T> {
  return {
    page: () => fetchPage(startCursor),
    [Symbol.asyncIterator]: (): AsyncIterator<T> => {
      let cursor = startCursor
      let exhausted = false
      const queue: T[] = []

      return {
        async next(): Promise<IteratorResult<T>> {
          while (queue.length === 0 && !exhausted) {
            const page = await fetchPage(cursor)
            queue.push(...page.data)
            if (page.hasMore && page.nextCursor !== null) {
              cursor = page.nextCursor
            } else {
              exhausted = true
            }
          }

          const value = queue.shift()
          if (value === undefined) {
            return { done: true, value: undefined }
          }
          return { done: false, value }
        },
      }
    },
  }
}
