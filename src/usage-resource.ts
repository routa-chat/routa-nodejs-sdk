import type { HttpClient } from './http/http-client'

/** Date range accepted by `usage.retrieve()` — mirrors the query params of `GET /v1/usage`. */
export interface UsageParams {
  /** UTC date, YYYY-MM-DD, inclusive. */
  readonly from: string
  /** UTC date, YYYY-MM-DD, exclusive. */
  readonly to: string
}

/** One metered quantity within a `usage.retrieve()` response, broken down by channel type and provider. */
export interface UsageRecord {
  readonly metric: string
  readonly channelType: string | null
  readonly provider: string | null
  readonly quantity: number
  readonly unit: string
}

/** A project's own metered usage for the requested date range. */
export interface Usage {
  readonly fromDate: string
  readonly toDate: string
  readonly data: readonly UsageRecord[]
}

interface RawUsageRecord {
  readonly metric: string
  readonly channel_type: string | null
  readonly provider: string | null
  readonly quantity: number
  readonly unit: string
}

/** Wire shape of a `GET /v1/usage` response. */
interface RawUsage {
  readonly from_date: string
  readonly to_date: string
  readonly data: readonly RawUsageRecord[]
}

/** `routa.usage.*` — a project's own metered usage. Orchestrates `http` — no transport logic of its own. */
export class UsageResource {
  constructor(private readonly http: HttpClient) {}

  async retrieve(params: UsageParams): Promise<Usage> {
    const raw = await this.http.request<RawUsage>({
      method: 'GET',
      path: '/v1/usage',
      searchParams: { from: params.from, to: params.to },
    })

    return {
      fromDate: raw.from_date,
      toDate: raw.to_date,
      data: raw.data.map(record => ({
        metric: record.metric,
        channelType: record.channel_type,
        provider: record.provider,
        quantity: record.quantity,
        unit: record.unit,
      })),
    }
  }
}
