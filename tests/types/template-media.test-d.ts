import { expectTypeOf, test } from 'vitest'
import type { MediaId } from '../../src/media/media-id'
import { toMediaId } from '../../src/media/media-id'
import type { TemplateHeaderMediaFormat } from '../../src/template/template-components'
import type { TemplateId } from '../../src/template/template-id'
import { toTemplateId } from '../../src/template/template-id'
import type { TemplateMedia } from '../../src/template/template-media'
import type { TemplateMediaId } from '../../src/template/template-media-id'
import { toTemplateMediaId } from '../../src/template/template-media-id'

test('TemplateMediaId, MediaId and TemplateId are not interchangeable', () => {
  const templateMediaId = toTemplateMediaId('tmedia_01J8XA1B2C3D4E5F6G7H8J9K0M')
  const mediaId = toMediaId('med_01J8XA1B2C3D4E5F6G7H8J9K0M')
  const templateId = toTemplateId('tmpl_01J8XA1B2C3D4E5F6G7H8J9K0M')

  expectTypeOf(templateMediaId).toEqualTypeOf<TemplateMediaId>()
  expectTypeOf(templateMediaId).not.toEqualTypeOf<MediaId>()
  expectTypeOf(mediaId).not.toEqualTypeOf<TemplateMediaId>()

  // @ts-expect-error — a MediaId must not be assignable to a TemplateMediaId.
  const fromMedia: TemplateMediaId = mediaId
  // @ts-expect-error — a TemplateId must not be assignable to a TemplateMediaId.
  const fromTemplate: TemplateMediaId = templateId
  // @ts-expect-error — a TemplateMediaId must not be assignable to a MediaId.
  const toMedia: MediaId = templateMediaId
  // @ts-expect-error — a TemplateMediaId must not be assignable to a TemplateId.
  const toTemplate: TemplateId = templateMediaId
  void [fromMedia, fromTemplate, toMedia, toTemplate]
})

test('TemplateMedia is read-only, with the three header formats', () => {
  expectTypeOf<TemplateMedia['id']>().toEqualTypeOf<TemplateMediaId>()
  expectTypeOf<TemplateMedia['format']>().toEqualTypeOf<
    'image' | 'video' | 'document'
  >()
  expectTypeOf<
    TemplateMedia['format']
  >().toEqualTypeOf<TemplateHeaderMediaFormat>()
  expectTypeOf<TemplateMedia['sizeBytes']>().toEqualTypeOf<number>()
  expectTypeOf<TemplateMedia['contentType']>().toEqualTypeOf<string>()
  expectTypeOf<TemplateMedia['createdAt']>().toEqualTypeOf<string>()

  const media: TemplateMedia = {
    id: toTemplateMediaId('tmedia_01J8XA1B2C3D4E5F6G7H8J9K0M'),
    format: 'image',
    sizeBytes: 1,
    contentType: 'image/png',
    createdAt: '2026-11-21T12:00:00.000Z',
  }
  // @ts-expect-error — a TemplateMedia is immutable once parsed.
  media.sizeBytes = 2
})
