import { expectTypeOf, test } from 'vitest'
import type { MediaId } from '../../src/media/media-id'
import { toMediaId } from '../../src/media/media-id'
import type { SubmitTemplateParams } from '../../src/template/submit-template'
import type { Template } from '../../src/template/template'
import type {
  TemplateButtonInput,
  TemplateComponentsInput,
  TemplateHeaderInput,
} from '../../src/template/template-components-input'
import type { TemplateMedia } from '../../src/template/template-media'
import type { TemplateMediaId } from '../../src/template/template-media-id'
import { toTemplateMediaId } from '../../src/template/template-media-id'
import type { TemplatesResource } from '../../src/template/templates-resource'
import type { UploadTemplateMediaParams } from '../../src/template/upload-template-media'

const MEDIA_ID = toTemplateMediaId('tmedia_01J8XA1B2C3D4E5F6G7H8J9K0M')

test('every kind of component is accepted with the fields it needs', () => {
  const components: TemplateComponentsInput = {
    header: { kind: 'media', mediaId: MEDIA_ID },
    footer: { text: 'Reply STOP to opt out' },
    buttons: [
      { kind: 'quick_reply', text: 'Thanks' },
      { kind: 'phone_number', text: 'Call us', phoneNumber: '+15550001111' },
      { kind: 'url', text: 'Track', url: 'https://example.com/track' },
    ],
  }
  const textHeader: TemplateHeaderInput = { kind: 'text', text: 'Order update' }
  const bodyOnly: SubmitTemplateParams = {
    channel: 'chan_1',
    name: 'n',
    language: 'en_US',
    category: 'utility',
    bodyText: 'hi',
  }
  const withComponents: SubmitTemplateParams = { ...bodyOnly, components }
  void [textHeader, withComponents]
})

test('a url button without its url does not compile', () => {
  // @ts-expect-error — a `url` button needs `url`.
  const button: TemplateButtonInput = { kind: 'url', text: 'Track' }
  void button
})

test('a phone_number button needs phoneNumber, and the API key name is not accepted', () => {
  // @ts-expect-error — a `phone_number` button needs `phoneNumber`.
  const missing: TemplateButtonInput = { kind: 'phone_number', text: 'Call' }
  const snakeCase: TemplateButtonInput = {
    kind: 'phone_number',
    text: 'Call',
    // @ts-expect-error — the input is camelCase: `phoneNumber`, not `phone_number`.
    phone_number: '+15550001111',
  }
  void [missing, snakeCase]
})

test('a quick_reply button takes no url or phoneNumber', () => {
  const extra: TemplateButtonInput = {
    kind: 'quick_reply',
    text: 'Thanks',
    // @ts-expect-error — a `quick_reply` button has only a label.
    url: 'https://example.com',
  }
  void extra
})

test('a media header needs mediaId, and only a TemplateMediaId fits', () => {
  // @ts-expect-error — a `media` header needs `mediaId`.
  const missing: TemplateHeaderInput = { kind: 'media' }
  const loose: TemplateHeaderInput = {
    kind: 'media',
    // @ts-expect-error — a plain string is not a TemplateMediaId.
    mediaId: 'tmedia_01J8XA1B2C3D4E5F6G7H8J9K0M',
  }
  const fromMedia: TemplateHeaderInput = {
    kind: 'media',
    // @ts-expect-error — a MediaId from `media.upload()` is a different kind of file.
    mediaId: toMediaId('med_01J8XA1B2C3D4E5F6G7H8J9K0M'),
  }
  const snakeCase: TemplateHeaderInput = {
    kind: 'media',
    // @ts-expect-error — the input is camelCase: `mediaId`, not `media_id`.
    media_id: MEDIA_ID,
  }
  void [missing, loose, fromMedia, snakeCase]
  expectTypeOf<MediaId>().not.toEqualTypeOf<TemplateMediaId>()
})

test('a text header needs text and takes no media fields', () => {
  // @ts-expect-error — a `text` header needs `text`.
  const missing: TemplateHeaderInput = { kind: 'text' }
  const mixed: TemplateHeaderInput = {
    kind: 'text',
    text: 'Hi',
    // @ts-expect-error — a `text` header has no media id.
    mediaId: MEDIA_ID,
  }
  void [missing, mixed]
})

test('an unknown button kind does not compile', () => {
  // @ts-expect-error — only quick_reply, phone_number and url exist.
  const button: TemplateButtonInput = { kind: 'copy_code', text: 'Copy' }
  void button
})

test('the input and read shapes are different types', () => {
  expectTypeOf<
    NonNullable<SubmitTemplateParams['components']>
  >().toEqualTypeOf<TemplateComponentsInput>()
  expectTypeOf<
    NonNullable<Template['components']>
  >().not.toEqualTypeOf<TemplateComponentsInput>()
})

test('uploadMedia() takes bytes with a content type and returns a TemplateMedia', () => {
  const bytes = new Uint8Array([1])
  const fromBytes: UploadTemplateMediaParams = {
    file: bytes,
    contentType: 'image/png',
  }
  const fromBlob: UploadTemplateMediaParams = {
    file: new Blob([bytes]),
    contentType: 'image/png',
  }
  void [fromBytes, fromBlob]

  expectTypeOf<
    TemplatesResource['uploadMedia']
  >().returns.resolves.toEqualTypeOf<TemplateMedia>()
  expectTypeOf<TemplatesResource['uploadMedia']>()
    .parameter(0)
    .toEqualTypeOf<UploadTemplateMediaParams>()
})

test('uploadMedia() has no sourceUrl mode', () => {
  const withUrl: UploadTemplateMediaParams = {
    file: new Uint8Array(1),
    contentType: 'image/png',
    // @ts-expect-error — `POST /v1/templates/media` only reads bytes.
    sourceUrl: 'https://example.com/a.png',
  }
  const onlyUrl: UploadTemplateMediaParams = {
    // @ts-expect-error — a URL alone is not an upload.
    sourceUrl: 'https://example.com/a.png',
  }
  void [withUrl, onlyUrl]
})

test('uploadMedia() rejects a file without its contentType', () => {
  // @ts-expect-error — the API learns the type from `contentType`; a Blob's own `type` is not used.
  const missing: UploadTemplateMediaParams = { file: new Blob(['x']) }
  void missing
})

test('uploadMedia() accepts only buffered files, not streams (D10)', () => {
  const stream: UploadTemplateMediaParams = {
    // @ts-expect-error — a ReadableStream cannot be re-sent on a retry.
    file: new ReadableStream(),
    contentType: 'image/png',
  }
  void stream
})

test('the id uploadMedia() returns is the id a media header takes', () => {
  function headerFor(media: TemplateMedia): TemplateHeaderInput {
    return { kind: 'media', mediaId: media.id }
  }
  void headerFor
})
