import {
  PARTNER_KEY_PREFIX,
  type ResolvedRoutaConfig,
  type RoutaTransportOptions,
  resolveTransportOptions,
} from '../config'

/**
 * Configuration accepted by the `RoutaPartner` constructor. The credential is
 * `partnerKey`, never `apiKey`: the two are different keys with different
 * reach, and a project API key is refused by every `/v1/partner/*` route.
 */
export interface PartnerConfig extends RoutaTransportOptions {
  /**
   * Bearer credential, `rt_partner_…`: sent as `Authorization: Bearer
   * <partnerKey>`. Required — there is no default. It is issued by a person
   * in the dashboard (Settings → Partner), never by the API, on a plan that
   * includes the Partner API. Treat it like a root credential: it reaches
   * every customer of the partner.
   */
  partnerKey: string
}

/** Accepted by the `RoutaPartner` constructor: a full config object, or just the partner key as shorthand for `{ partnerKey }`. */
export type PartnerConfigInput = PartnerConfig | string

/**
 * Validates `input` and fills in every default, failing synchronously if
 * `partnerKey` is missing, or is not a partner key. Resolves to the same
 * shape the transport already consumes, with the partner key as its Bearer
 * credential.
 */
export function resolvePartnerConfig(
  input: PartnerConfigInput
): ResolvedRoutaConfig {
  const config: PartnerConfig =
    typeof input === 'string' ? { partnerKey: input } : input
  const { partnerKey } = config

  if (!partnerKey) {
    throw new Error(
      'RoutaPartner: `partnerKey` is required and cannot be empty. A partner key (`rt_partner_…`) is issued in the Routa dashboard, under Settings → Partner.'
    )
  }
  if (!partnerKey.startsWith(PARTNER_KEY_PREFIX)) {
    throw new Error(
      looksLikeProjectApiKey(partnerKey)
        ? "RoutaPartner: this looks like a project API key (`rt_live_…` or `rt_test_…`), which the Partner API refuses. Use `Routa` from '@routa-chat/sdk' with it, or give `RoutaPartner` a partner key (`rt_partner_…`)."
        : 'RoutaPartner: `partnerKey` must be a partner key, which starts with `rt_partner_`.'
    )
  }

  // The transport sends whatever it is given as `apiKey` as the Bearer
  // credential; the partner key is that credential here.
  return { apiKey: partnerKey, ...resolveTransportOptions(config) }
}

function looksLikeProjectApiKey(value: string): boolean {
  return value.startsWith('rt_live_') || value.startsWith('rt_test_')
}
