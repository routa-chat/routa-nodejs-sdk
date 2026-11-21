import { type Page, type PageIterable, paginate } from '../../domain/pagination'
import type { HttpClient } from '../../http/http-client'
import { ProjectApiKeysResource } from '../api-key/project-api-keys-resource'
import type {
  PartnerProject,
  PartnerProjectDetail,
  ProjectCreateResult,
  ProjectDeleteResult,
} from './partner-project'
import type { PartnerProjectId } from './partner-project-id'
import { toPartnerProjectId } from './partner-project-id'
import {
  parsePartnerProject,
  parsePartnerProjectDetail,
  type RawPartnerProject,
  type RawPartnerProjectDeleting,
  type RawPartnerProjectDetail,
  type RawPartnerProjectPage,
} from './partner-project-mapper'
import {
  type CreateProjectParams,
  type ListProjectsParams,
  serializeCreateProjectParams,
  serializeListProjectsParams,
  type UpdateProjectParams,
} from './project-params'

/** HTTP status of `DELETE /v1/partner/projects/{projectId}` when the project is large and only part of it was erased. */
const DELETE_PARTIAL_STATUS = 202

/**
 * `partner.projects.*` — one project per customer, tied to the partner's own
 * id for that customer by `externalRef`. Orchestrates `http` — no transport
 * logic of its own.
 */
export class ProjectsResource {
  /** `partner.projects.apiKeys.*` — the key each customer's traffic is sent with. */
  readonly apiKeys: ProjectApiKeysResource

  constructor(private readonly http: HttpClient) {
    this.apiKeys = new ProjectApiKeysResource(http)
  }

  /**
   * Creates the project of a customer, or returns the one that already has
   * this `externalRef`. Idempotent by `externalRef`: repeating the call (a
   * retry, a second click) never creates two. Needs `projects:write`.
   *
   * @throws {RoutaBillingError} `project_limit_exceeded` (`402`) above the plan's project limit. An abandoned onboarding still counts: reuse its project through its `externalRef`, or `delete()` it.
   */
  async create(params: CreateProjectParams): Promise<ProjectCreateResult> {
    const { data, status } =
      await this.http.requestWithHeaders<RawPartnerProject>({
        method: 'POST',
        path: '/v1/partner/projects',
        body: serializeCreateProjectParams(params),
      })
    return { project: parsePartnerProject(data), created: status === 201 }
  }

  /** Lists the customers' projects. Needs `projects:read`. */
  list(params: ListProjectsParams = {}): PageIterable<PartnerProject> {
    return paginate(
      cursor => this.fetchProjectsPage(params, cursor),
      params.cursor
    )
  }

  /**
   * Reads a project **with its channels** — how a partner confirms an
   * onboarding. The redirect back to your `redirectUrl` is only a hint
   * (anyone can forge a request to it); trust this. Needs `projects:read`.
   */
  async retrieve(id: PartnerProjectId): Promise<PartnerProjectDetail> {
    const raw = await this.http.request<RawPartnerProjectDetail>({
      method: 'GET',
      path: `/v1/partner/projects/${id}`,
    })
    return parsePartnerProjectDetail(raw)
  }

  /** Renames a project. `externalRef` cannot change. Needs `projects:write`. */
  async update(
    id: PartnerProjectId,
    params: UpdateProjectParams
  ): Promise<PartnerProject> {
    const raw = await this.http.request<RawPartnerProject>({
      method: 'PATCH',
      path: `/v1/partner/projects/${id}`,
      body: { name: params.name },
    })
    return parsePartnerProject(raw)
  }

  /**
   * Deletes a project and everything it owns (messages, templates, events,
   * contacts, keys, webhook endpoints, media and its disabled channels —
   * their numbers are free again; nothing is changed at WhatsApp), to give
   * back a slot of the plan's project limit. Needs the opt-in
   * `projects:delete` scope.
   *
   * Answers `{ status: 'deleted' }` when it is gone, or
   * `{ status: 'deleting', projectId }` when the project was large and only
   * part of it was erased: call again until it answers `deleted`.
   *
   * @throws {RoutaConflictError} `project_not_deletable` (`409`); its `reason` says why: `has_enabled_channel` (a channel that is not `disabled` — the customer disables it in WhatsApp or the dashboard) or `last_project` (never the organization's last project). The API's contract also names `not_partner_project`, but the backend answers `404` for a project that was not made through this API.
   */
  async delete(id: PartnerProjectId): Promise<ProjectDeleteResult> {
    const { data, status } = await this.http.requestWithHeaders<
      RawPartnerProjectDeleting | undefined
    >({
      method: 'DELETE',
      path: `/v1/partner/projects/${id}`,
    })
    if (status === DELETE_PARTIAL_STATUS && data !== undefined) {
      return {
        status: 'deleting',
        projectId: toPartnerProjectId(data.project_id),
      }
    }
    return { status: 'deleted' }
  }

  private async fetchProjectsPage(
    params: ListProjectsParams,
    cursor: string | undefined
  ): Promise<Page<PartnerProject>> {
    const raw = await this.http.request<RawPartnerProjectPage>({
      method: 'GET',
      path: '/v1/partner/projects',
      searchParams: serializeListProjectsParams(params, cursor),
    })
    return {
      data: raw.data.map(parsePartnerProject),
      hasMore: raw.has_more,
      nextCursor: raw.next_cursor,
    }
  }
}
