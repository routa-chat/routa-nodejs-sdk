/** Parameters accepted by `projects.create()` — mirrors the `POST /v1/partner/projects` body. */
export interface CreateProjectParams {
  /** What the project is called, shown to the customer on the connect page; at most 200 characters. A display name, not an identity. */
  readonly name: string
  /**
   * Your own id for the customer this project serves: 1 to 128 of
   * `A-Z a-z 0-9 . _ : -` (an opaque id, never an email, a phone number or a
   * name). Unique in your organization and set once.
   */
  readonly externalRef: string
}

/** Filters accepted by `projects.list()` — mirrors the query params of `GET /v1/partner/projects`. */
export interface ListProjectsParams {
  /** Only the project with this `externalRef` (an empty page when nobody holds it). */
  readonly externalRef?: string
  /** `true`: only projects with a channel of any status. `false`: only those with none — a project whose only channels are `disabled` is not in it. */
  readonly hasChannel?: boolean
  /** Max items per page (1-200, 50 by default). */
  readonly limit?: number
  readonly cursor?: string
}

/**
 * Parameters accepted by `projects.update()`. Only `name` is exposed: the API
 * accepts an `external_ref` in the body but it is immutable, so the call could
 * only fail (`422 external_ref_immutable`).
 */
export interface UpdateProjectParams {
  readonly name: string
}

interface CreateProjectRequestBody {
  name: string
  external_ref: string
}

export function serializeCreateProjectParams(
  params: CreateProjectParams
): CreateProjectRequestBody {
  return { name: params.name, external_ref: params.externalRef }
}

export function serializeListProjectsParams(
  params: ListProjectsParams,
  cursor: string | undefined
): Record<string, string> {
  const searchParams: Record<string, string> = {}
  if (params.externalRef !== undefined) {
    searchParams['external_ref'] = params.externalRef
  }
  if (params.hasChannel !== undefined) {
    searchParams['has_channel'] = params.hasChannel ? 'true' : 'false'
  }
  if (params.limit !== undefined) {
    searchParams['limit'] = String(params.limit)
  }
  if (cursor !== undefined) {
    searchParams['cursor'] = cursor
  }
  return searchParams
}
