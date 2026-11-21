import { expectTypeOf, test } from 'vitest'
import type { Media } from '../../src/media/media'
import type { MediaId } from '../../src/media/media-id'
import { toMediaId } from '../../src/media/media-id'
import type { MediaResource } from '../../src/media/media-resource'
import type { UploadMediaParams } from '../../src/media/upload-media'

test('upload() takes either bytes with a content type, or a sourceUrl', () => {
  const bytes = new Uint8Array([1])
  const blob = new Blob([bytes])

  const fromBytes: UploadMediaParams = { file: bytes, contentType: 'image/png' }
  const fromBlob: UploadMediaParams = { file: blob, contentType: 'image/png' }
  const fromUrl: UploadMediaParams = { sourceUrl: 'https://example.com/a.png' }
  void [fromBytes, fromBlob, fromUrl]

  expectTypeOf<
    MediaResource['upload']
  >().returns.resolves.toEqualTypeOf<Media>()
})

test('upload() rejects a file without its contentType', () => {
  // @ts-expect-error — the API learns the type from `contentType`; a Blob's own `type` is not used.
  const missingContentType: UploadMediaParams = { file: new Blob(['x']) }
  void missingContentType
})

test('upload() rejects mixing the two modes', () => {
  // @ts-expect-error — `file` and `sourceUrl` are different modes.
  const both: UploadMediaParams = {
    file: new Uint8Array(1),
    contentType: 'image/png',
    sourceUrl: 'https://example.com/a.png',
  }
  // @ts-expect-error — `sourceUrl` mode takes no `contentType`.
  const urlWithType: UploadMediaParams = {
    sourceUrl: 'https://example.com/a.png',
    contentType: 'image/png',
  }
  // @ts-expect-error — a mode is required.
  const neither: UploadMediaParams = {}
  void [both, urlWithType, neither]
})

test('upload() accepts only buffered files, not streams (D10)', () => {
  const stream: UploadMediaParams = {
    // @ts-expect-error — a ReadableStream cannot be re-sent on a retry.
    file: new ReadableStream(),
    contentType: 'image/png',
  }
  void stream
})

test('the id upload() returns is a MediaId', () => {
  expectTypeOf(
    toMediaId('med_01J8XA1B2C3D4E5F6G7H8J9K0M')
  ).toEqualTypeOf<MediaId>()
})
