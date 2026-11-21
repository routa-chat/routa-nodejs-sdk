import { describe, expect, it } from 'vitest'
import {
  isTemplateMediaId,
  toTemplateMediaId,
} from '../../../src/template/template-media-id'
import {
  parseTemplateMedia,
  type RawTemplateMedia,
} from '../../../src/template/template-media-mapper'

// No example bodies exist in the OpenAPI snapshot (schemas only), so this is
// built by hand from what the `POST /v1/templates/media` 201 schema allows:
// `format` is one of image/video/document, `size_bytes` a number, `created_at`
// a date-time string. The `tmedia_` prefix comes from the backend's
// `TemplateMediaId = Id<'tmedia'>` (packages/templates/src/domain/ids.ts).
function rawTemplateMedia(
  overrides: Partial<RawTemplateMedia> = {}
): RawTemplateMedia {
  return {
    id: 'tmedia_01J8XA1B2C3D4E5F6G7H8J9K0M',
    format: 'image',
    size_bytes: 48_213,
    content_type: 'image/png',
    created_at: '2026-11-21T12:00:00.000Z',
    ...overrides,
  }
}

describe('parseTemplateMedia', () => {
  it('maps the snake_case wire shape to the camelCase TemplateMedia', () => {
    expect(parseTemplateMedia(rawTemplateMedia())).toEqual({
      id: 'tmedia_01J8XA1B2C3D4E5F6G7H8J9K0M',
      format: 'image',
      sizeBytes: 48_213,
      contentType: 'image/png',
      createdAt: '2026-11-21T12:00:00.000Z',
    })
  })

  it.each([
    ['image', 'image/jpeg'],
    ['video', 'video/mp4'],
    ['document', 'application/pdf'],
  ] as const)('keeps format %s as-is', (format, contentType) => {
    const media = parseTemplateMedia(
      rawTemplateMedia({ format, content_type: contentType })
    )

    expect(media.format).toBe(format)
    expect(media.contentType).toBe(contentType)
  })
})

describe('TemplateMediaId', () => {
  it('recognises the tmedia_ prefix', () => {
    expect(isTemplateMediaId('tmedia_01J8XA1B2C3D4E5F6G7H8J9K0M')).toBe(true)
    expect(toTemplateMediaId('tmedia_01J8XA1B2C3D4E5F6G7H8J9K0M')).toBe(
      'tmedia_01J8XA1B2C3D4E5F6G7H8J9K0M'
    )
  })

  it('does not accept a media or template id', () => {
    expect(isTemplateMediaId('med_01J8XA1B2C3D4E5F6G7H8J9K0M')).toBe(false)
    expect(isTemplateMediaId('tmpl_01J8XA1B2C3D4E5F6G7H8J9K0M')).toBe(false)
    expect(isTemplateMediaId('tmedia_short')).toBe(false)
  })
})
