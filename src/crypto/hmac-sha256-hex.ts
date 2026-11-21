/**
 * `HMAC-SHA256(secret, message)` as lowercase hex, computed with the Web
 * Crypto API rather than a Node-only module — this runs on every target
 * runtime (Node, Bun, Deno, edge) without a platform-specific import.
 * Shared by the webhook signature check and the partner onboarding link.
 */
export async function hmacSha256Hex(
  secret: string,
  message: Uint8Array
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const digest = await crypto.subtle.sign('HMAC', key, message)
  return toHex(new Uint8Array(digest))
}

export function toHex(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}
