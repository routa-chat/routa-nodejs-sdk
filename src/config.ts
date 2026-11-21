/**
 * Receives structured diagnostics from the client — e.g. the request id of a
 * call — without the SDK ever writing to `console` itself. Never receives an
 * API key or a request/response body (see the security notes on `RoutaConfig`).
 */
export interface RoutaLogger {
  debug(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
}

/**
 * The options every client shares, whatever credential it carries: where to
 * send requests and how. `RoutaConfig` adds the project API key; the partner
 * client's own config adds a partner key instead — never both.
 */
export interface RoutaTransportOptions {
  /** Origin the client sends requests to. Defaults to the production API. */
  baseURL?: string
  /** Combined connect+response timeout per attempt, in milliseconds. */
  timeout?: number
  /** Maximum number of retry attempts after the initial request. */
  maxRetries?: number
  /** Receives request diagnostics. Defaults to a no-op logger. */
  logger?: RoutaLogger
  /** Overrides the `fetch` implementation used for every request — e.g. to inject a custom agent or a test double. */
  fetch?: typeof fetch
}

/** Configuration accepted by the `Routa` client constructor. */
export interface RoutaConfig extends RoutaTransportOptions {
  /** Bearer credential sent as `Authorization: Bearer <apiKey>`. Required — there is no default. */
  apiKey: string
}

/** Accepted by the `Routa` constructor: a full config object, or just the API key as shorthand for `{ apiKey }`. */
export type RoutaConfigInput = RoutaConfig | string

/** `RoutaConfig` with every optional field defaulted, ready for the transport layer to consume. */
export interface ResolvedRoutaConfig {
  readonly apiKey: string
  readonly baseURL: string
  readonly timeout: number
  readonly maxRetries: number
  readonly logger: RoutaLogger
  readonly fetch: typeof fetch
}

/** Prefix of a partner key, which `Routa` refuses — see `assertNotPartnerKey`. */
export const PARTNER_KEY_PREFIX = 'rt_partner_'

const DEFAULT_BASE_URL = 'https://api.routa.chat'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 3

const noopLogger: RoutaLogger = {
  debug() {},
  warn() {},
  error() {},
}

/** Every shared option with its default applied — what `resolveConfig` and the partner client's own resolver both build on. */
export function resolveTransportOptions(
  options: RoutaTransportOptions
): Omit<ResolvedRoutaConfig, 'apiKey'> {
  return {
    baseURL: options.baseURL ?? DEFAULT_BASE_URL,
    timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    logger: options.logger ?? noopLogger,
    fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
  }
}

/**
 * Validates `input` and fills in every default, failing synchronously if
 * `apiKey` is missing or empty, or is a partner key — a caller should never
 * discover a bad configuration from a confusing network error on the first
 * real call.
 */
export function resolveConfig(input: RoutaConfigInput): ResolvedRoutaConfig {
  const config: RoutaConfig =
    typeof input === 'string' ? { apiKey: input } : input

  if (!config.apiKey) {
    throw new Error(
      'Routa: `apiKey` is required and cannot be empty. Get one from your Routa dashboard.'
    )
  }
  assertNotPartnerKey(config.apiKey)

  return { apiKey: config.apiKey, ...resolveTransportOptions(config) }
}

/**
 * A partner key (`rt_partner_…`) is accepted only by `/v1/partner/*`, so a
 * `Routa` client built on one would answer `401` to every call. A string
 * check only: the partner client lives in its own entry point and this one
 * must not import it.
 */
function assertNotPartnerKey(apiKey: string): void {
  if (apiKey.startsWith(PARTNER_KEY_PREFIX)) {
    throw new Error(
      "Routa: this is a partner key (`rt_partner_…`), which `Routa` cannot use: it is accepted only by the Partner API. Use `RoutaPartner` from '@routa-chat/sdk/partner' with it, or give `Routa` a project API key (`rt_live_…` or `rt_test_…`)."
    )
  }
}
