import type { ChannelId } from '../../domain/channel-id'
import type { PartnerProjectId } from './partner-project-id'

/** Whether a project sends real traffic (`live`) or is a sandbox (`test`). */
export type PartnerProjectEnvironment = 'live' | 'test'

/** One customer of the partner, as the partner sees it. */
export interface PartnerProject {
  readonly id: PartnerProjectId
  /** What the project is called, shown to the customer on the connect page. */
  readonly name: string
  /** The partner's own id for the customer this project serves. Set once, never changed. */
  readonly externalRef: string
  readonly environment: PartnerProjectEnvironment
  readonly createdAt: string
}

/** A channel as `projects.retrieve()` lists it: enough to tell whether a customer's onboarding finished. */
export interface PartnerProjectChannelSummary {
  readonly id: ChannelId
  /**
   * The channel's status as the API reports it, e.g. `active` or `disabled`.
   * Typed `string` because that is all the API's contract promises here;
   * `channels.list()` returns the closed `PartnerChannelStatus` union.
   */
  readonly status: string
}

/** A `PartnerProject` with its channels — the one read that carries them, and so how a partner confirms an onboarding. */
export interface PartnerProjectDetail extends PartnerProject {
  readonly channels: readonly PartnerProjectChannelSummary[]
}

/** What `projects.create()` returns. */
export interface ProjectCreateResult {
  readonly project: PartnerProject
  /** `true` when this call created the project (`201`), `false` when `externalRef` already had one and it was returned as it was (`200`). */
  readonly created: boolean
}

/**
 * What `projects.delete()` returns. A union on `status`, so a caller has to
 * handle both: `deleted` means the project is gone; `deleting` means it was
 * large and only part of it was erased — the same call continues from where
 * it stopped, so repeat it until it answers `deleted`.
 */
export type ProjectDeleteResult =
  | { readonly status: 'deleted' }
  | { readonly status: 'deleting'; readonly projectId: PartnerProjectId }
