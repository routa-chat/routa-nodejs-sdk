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

/** Configuration accepted by the `Routa` client constructor. */
export interface RoutaConfig {
  /** Bearer credential sent as `Authorization: Bearer <apiKey>`. Required — there is no default. */
  apiKey: string
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

const DEFAULT_BASE_URL = 'https://api.routa.chat'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 3

const noopLogger: RoutaLogger = {
  debug() {},
  warn() {},
  error() {},
}

/**
 * Validates `input` and fills in every default, failing synchronously if
 * `apiKey` is missing or empty — a caller should never discover a bad
 * configuration from a confusing network error on the first real call.
 */
export function resolveConfig(input: RoutaConfigInput): ResolvedRoutaConfig {
  const config: RoutaConfig =
    typeof input === 'string' ? { apiKey: input } : input

  if (!config.apiKey) {
    throw new Error(
      'Routa: `apiKey` is required and cannot be empty. Get one from your Routa dashboard.'
    )
  }

  return {
    apiKey: config.apiKey,
    baseURL: config.baseURL ?? DEFAULT_BASE_URL,
    timeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    logger: config.logger ?? noopLogger,
    fetch: config.fetch ?? globalThis.fetch.bind(globalThis),
  }
}
