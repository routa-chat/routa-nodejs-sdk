import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * The shape of the reference webhook-signing implementation this loader
 * needs — not a reimplementation of the signing algorithm, a real,
 * unmodified import of it. Signing a payload with the SDK's own verifier's
 * twin would prove nothing: a bug shared by both sides would still pass.
 * This loads the actual module a real webhook delivery runs, from a local
 * checkout the caller points it at, so a signature produced here is
 * indistinguishable from one a real delivery would produce.
 */
export interface RealWebhookSignatureModule {
  buildSignatureHeader(
    secrets: readonly string[],
    timestampSeconds: number,
    rawBody: Uint8Array
  ): string
}

/**
 * `undefined` when the external signing implementation isn't configured —
 * callers skip gracefully rather than fail, the same convention every other
 * conformance scenario follows when its environment isn't configured. The
 * import specifier is computed at runtime (never a string literal), so this
 * module carries no compile-time dependency on that implementation either.
 */
export async function loadRealWebhookSigner(): Promise<
  RealWebhookSignatureModule | undefined
> {
  const configuredPath = process.env['ROUTA_SDK_CONFORMANCE_SIGNER_PATH']
  if (!configuredPath) {
    return undefined
  }
  const path = resolve(configuredPath)

  try {
    const moduleUrl = pathToFileURL(path).href
    const loaded: unknown = await import(/* @vite-ignore */ moduleUrl)
    if (
      typeof loaded === 'object' &&
      loaded !== null &&
      'buildSignatureHeader' in loaded &&
      typeof loaded.buildSignatureHeader === 'function'
    ) {
      return loaded as RealWebhookSignatureModule
    }
    return undefined
  } catch {
    return undefined
  }
}
