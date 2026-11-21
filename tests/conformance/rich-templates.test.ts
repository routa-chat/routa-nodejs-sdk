import { describe, expect, it } from 'vitest'
import { Routa } from '../../src/client'
import { RoutaInvalidRequestError } from '../../src/domain/errors/routa-invalid-request-error'
import type { TemplateComponentsInput } from '../../src/template/template-components-input'
import { toTemplateMediaId } from '../../src/template/template-media-id'
import {
  apiReachable,
  BASE_URL,
  hasChannelFixture,
  requireChannelFixture,
} from './support/environment'
import { provisionSharedApiKey } from './support/provisioning'

/**
 * Rich templates (`components` on `templates.submit()` and
 * `templates.uploadMedia()`), end to end against a real, locally running API
 * instance — no mocked `fetch` stands in for the server. Skipped, never faked,
 * when that instance is not reachable.
 *
 * Two kinds of scenario, kept apart because they need different things:
 *
 * - **Header media upload** needs only a project and a `templates:write` key,
 *   so it signs up one organization/project (shared by those scenarios) and
 *   issues its own key per scenario.
 * - **Submitting a template** needs a channel that can send templates, and the
 *   API checks the channel before anything else — an unknown channel answers
 *   `404 channel_not_found` before the components are even looked at. Those
 *   scenarios use the pre-provisioned channel of `ROUTA_TEST_CHANNEL_ID`, with
 *   `ROUTA_TEST_API_KEY` (which, for this file, must also carry the
 *   `templates:write` and `templates:read` scopes), and are skipped by
 *   `hasChannelFixture` like the other channel scenarios. Each submission is
 *   recorded in that channel's project and handed to the provider by the API's
 *   worker, so run them against a channel you can litter with test templates.
 */

/** A real 1×1 PNG: the API checks the file's first bytes against the declared type, so a stand-in string would be rejected. */
const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  )
)

/** Only its first bytes are checked at upload, so five bytes of the signature make a "PDF" for this purpose. */
const PDF_BYTES = new TextEncoder().encode('%PDF-1.4\n%%EOF\n')

/** The box size, then `ftyp` at byte 4 — all the API looks at to accept the type. */
const MP4_BYTES = Uint8Array.from([
  0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00,
  0x00, 0x02, 0x00,
])

/** A client on a fresh project with a key scoped exactly to `scopes`. */
async function projectClient(scopes: readonly string[]): Promise<Routa> {
  const { apiKey } = await provisionSharedApiKey(BASE_URL, scopes)
  return new Routa({
    apiKey: apiKey.secret,
    baseURL: BASE_URL,
    maxRetries: 0,
  })
}

/** A client on the project that owns the pre-provisioned channel, and that channel's id. */
function channelClient(): { routa: Routa; channel: string } {
  const { apiKey, channelId } = requireChannelFixture()
  return {
    routa: new Routa({ apiKey, baseURL: BASE_URL, maxRetries: 0 }),
    channel: channelId,
  }
}

/** A name the provider's rules accept (lowercase letters, digits, underscores), unique per run. */
function templateName(): string {
  return `sdk_conf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

describe.skipIf(!apiReachable)(
  'template header media — real API server',
  () => {
    it('uploads an image and reports format image', async () => {
      const routa = await projectClient(['templates:write'])

      const media = await routa.templates.uploadMedia({
        file: PNG_1X1,
        contentType: 'image/png',
      })

      expect(media.id).toMatch(/^tmedia_/)
      expect(media.format).toBe('image')
      expect(media.contentType).toBe('image/png')
      expect(media.sizeBytes).toBe(PNG_1X1.byteLength)
      expect(Number.isNaN(Date.parse(media.createdAt))).toBe(false)
    })

    it('uploading a Blob works the same as uploading bytes', async () => {
      const routa = await projectClient(['templates:write'])

      const media = await routa.templates.uploadMedia({
        file: new Blob([PNG_1X1]),
        contentType: 'image/png',
      })

      expect(media.format).toBe('image')
      expect(media.sizeBytes).toBe(PNG_1X1.byteLength)
    })

    it('derives format document from application/pdf and video from video/mp4', async () => {
      const routa = await projectClient(['templates:write'])

      const pdf = await routa.templates.uploadMedia({
        file: PDF_BYTES,
        contentType: 'application/pdf',
      })
      const video = await routa.templates.uploadMedia({
        file: MP4_BYTES,
        contentType: 'video/mp4',
      })

      expect(pdf.format).toBe('document')
      expect(video.format).toBe('video')
    })

    it('422 template_media_invalid, with no param — a content type a header cannot use', async () => {
      const routa = await projectClient(['templates:write'])

      const error = await routa.templates
        .uploadMedia({ file: PNG_1X1, contentType: 'image/gif' })
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(RoutaInvalidRequestError)
      const apiError = error as RoutaInvalidRequestError
      expect(apiError.statusCode).toBe(422)
      expect(apiError.code).toBe('template_media_invalid')
      expect(apiError.param).toBeUndefined()
      expect(apiError.requestId).toBeTruthy()
    })

    it('422 template_media_invalid — bytes that do not match the declared type', async () => {
      const routa = await projectClient(['templates:write'])

      // PNG bytes declared as a PDF: the type is supported, but the content is not that type.
      const error = await routa.templates
        .uploadMedia({ file: PNG_1X1, contentType: 'application/pdf' })
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(RoutaInvalidRequestError)
      expect((error as RoutaInvalidRequestError).statusCode).toBe(422)
      expect((error as RoutaInvalidRequestError).code).toBe(
        'template_media_invalid'
      )
    })

    it('403 insufficient_scope — a key issued without templates:write', async () => {
      const routa = await projectClient(['templates:read'])

      const error = await routa.templates
        .uploadMedia({ file: PNG_1X1, contentType: 'image/png' })
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(RoutaInvalidRequestError)
      expect((error as RoutaInvalidRequestError).statusCode).toBe(403)
      expect((error as RoutaInvalidRequestError).code).toBe(
        'insufficient_scope'
      )
    })

    it('404 channel_not_found comes before the media is looked at — an unknown channel hides a bad mediaId', async () => {
      const routa = await projectClient(['templates:write'])

      const error = await routa.templates
        .submit({
          channel: 'chan_00000000000000000000000000',
          name: templateName(),
          language: 'en_US',
          category: 'utility',
          bodyText: 'Your order has shipped.',
          components: {
            header: {
              kind: 'media',
              mediaId: toTemplateMediaId('tmedia_00000000000000000000000000'),
            },
          },
        })
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(RoutaInvalidRequestError)
      expect((error as RoutaInvalidRequestError).statusCode).toBe(404)
      expect((error as RoutaInvalidRequestError).code).toBe('channel_not_found')
    })
  }
)

describe.skipIf(!hasChannelFixture)(
  'submitting templates with components — real API server, real channel',
  () => {
    async function submitAndReadBack(
      components: TemplateComponentsInput | undefined
    ) {
      const { routa, channel } = channelClient()
      const submitted = await routa.templates.submit({
        channel,
        name: templateName(),
        language: 'en_US',
        category: 'utility',
        bodyText: 'Your order has shipped.',
        ...(components !== undefined ? { components } : {}),
      })
      const retrieved = await routa.templates.retrieve(submitted.id)
      return { routa, channel, submitted, retrieved }
    }

    it('a body-only template is recorded as submitted, with no components', async () => {
      const { submitted, retrieved } = await submitAndReadBack(undefined)

      expect(submitted.id).toMatch(/^tmpl_/)
      expect(submitted.status).toBe('submitted')
      expect(submitted.origin).toBe('routa')
      expect(submitted.components).toBeUndefined()
      expect(retrieved.components).toBeUndefined()
    })

    it('a text header is accepted and read back as sent', async () => {
      const { submitted, retrieved } = await submitAndReadBack({
        header: { kind: 'text', text: 'Order update' },
      })

      const expected = { header: { kind: 'text', text: 'Order update' } }
      expect(submitted.status).toBe('submitted')
      expect(submitted.components).toEqual(expected)
      expect(retrieved.components).toEqual(expected)
    })

    it('a footer is accepted and read back as sent', async () => {
      const { submitted, retrieved } = await submitAndReadBack({
        footer: { text: 'Reply STOP to opt out' },
      })

      const expected = { footer: { text: 'Reply STOP to opt out' } }
      expect(submitted.components).toEqual(expected)
      expect(retrieved.components).toEqual(expected)
    })

    it('a quick_reply button is accepted and read back as sent', async () => {
      const { submitted, retrieved } = await submitAndReadBack({
        buttons: [{ kind: 'quick_reply', text: 'Thanks' }],
      })

      const expected = { buttons: [{ kind: 'quick_reply', text: 'Thanks' }] }
      expect(submitted.components).toEqual(expected)
      expect(retrieved.components).toEqual(expected)
    })

    it('a phone_number button is accepted and comes back with the API key name phone_number', async () => {
      const { submitted, retrieved } = await submitAndReadBack({
        buttons: [
          {
            kind: 'phone_number',
            text: 'Call us',
            phoneNumber: '+15550001111',
          },
        ],
      })

      const expected = {
        buttons: [
          {
            kind: 'phone_number',
            text: 'Call us',
            phone_number: '+15550001111',
          },
        ],
      }
      expect(submitted.components).toEqual(expected)
      expect(retrieved.components).toEqual(expected)
    })

    it('a url button is accepted and read back as sent', async () => {
      const { submitted, retrieved } = await submitAndReadBack({
        buttons: [
          { kind: 'url', text: 'Track', url: 'https://example.com/track' },
        ],
      })

      const expected = {
        buttons: [
          { kind: 'url', text: 'Track', url: 'https://example.com/track' },
        ],
      }
      expect(submitted.components).toEqual(expected)
      expect(retrieved.components).toEqual(expected)
    })

    it('upload an image, then create a template with an image header, a footer and two buttons', async () => {
      const { routa, channel } = channelClient()

      const media = await routa.templates.uploadMedia({
        file: PNG_1X1,
        contentType: 'image/png',
      })
      const submitted = await routa.templates.submit({
        channel,
        name: templateName(),
        language: 'en_US',
        category: 'utility',
        bodyText: 'Your order has shipped.',
        components: {
          header: { kind: 'media', mediaId: media.id },
          footer: { text: 'Reply STOP to opt out' },
          buttons: [
            { kind: 'quick_reply', text: 'Thanks' },
            { kind: 'url', text: 'Track', url: 'https://example.com/track' },
          ],
        },
      })

      // The format was never sent: the API took it from the upload's content type.
      const expected = {
        header: { kind: 'media', format: 'image', media_id: media.id },
        footer: { text: 'Reply STOP to opt out' },
        buttons: [
          { kind: 'quick_reply', text: 'Thanks' },
          { kind: 'url', text: 'Track', url: 'https://example.com/track' },
        ],
      }
      expect(submitted.status).toBe('submitted')
      expect(submitted.components).toEqual(expected)
      expect((await routa.templates.retrieve(submitted.id)).components).toEqual(
        expected
      )
    })

    it('header, footer and all three button kinds together', async () => {
      const { submitted, retrieved } = await submitAndReadBack({
        header: { kind: 'text', text: 'Order update' },
        footer: { text: 'Reply STOP to opt out' },
        buttons: [
          { kind: 'quick_reply', text: 'Thanks' },
          {
            kind: 'phone_number',
            text: 'Call us',
            phoneNumber: '+15550001111',
          },
          { kind: 'url', text: 'Track', url: 'https://example.com/track' },
        ],
      })

      const expected = {
        header: { kind: 'text', text: 'Order update' },
        footer: { text: 'Reply STOP to opt out' },
        buttons: [
          { kind: 'quick_reply', text: 'Thanks' },
          {
            kind: 'phone_number',
            text: 'Call us',
            phone_number: '+15550001111',
          },
          { kind: 'url', text: 'Track', url: 'https://example.com/track' },
        ],
      }
      expect(submitted.components).toEqual(expected)
      expect(retrieved.components).toEqual(expected)
    })

    it('404 template_media_not_found — a mediaId that does not exist, with no param', async () => {
      const { routa, channel } = channelClient()

      const error = await routa.templates
        .submit({
          channel,
          name: templateName(),
          language: 'en_US',
          category: 'utility',
          bodyText: 'Your order has shipped.',
          components: {
            header: {
              kind: 'media',
              mediaId: toTemplateMediaId('tmedia_00000000000000000000000000'),
            },
          },
        })
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(RoutaInvalidRequestError)
      const apiError = error as RoutaInvalidRequestError
      expect(apiError.statusCode).toBe(404)
      expect(apiError.code).toBe('template_media_not_found')
      expect(apiError.param).toBeUndefined()
    })

    // `apiReachable` is implied by `hasChannelFixture`, so the shared project below signs up.
    it('404 template_media_not_found — a mediaId uploaded in another project', async () => {
      const other = await projectClient(['templates:write'])
      const foreign = await other.templates.uploadMedia({
        file: PNG_1X1,
        contentType: 'image/png',
      })
      const { routa, channel } = channelClient()

      const error = await routa.templates
        .submit({
          channel,
          name: templateName(),
          language: 'en_US',
          category: 'utility',
          bodyText: 'Your order has shipped.',
          components: { header: { kind: 'media', mediaId: foreign.id } },
        })
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(RoutaInvalidRequestError)
      expect((error as RoutaInvalidRequestError).statusCode).toBe(404)
      expect((error as RoutaInvalidRequestError).code).toBe(
        'template_media_not_found'
      )
    })

    it('422 template_components_invalid — param names the component, not the item inside it', async () => {
      const { routa, channel } = channelClient()

      const error = await routa.templates
        .submit({
          channel,
          name: templateName(),
          language: 'en_US',
          category: 'utility',
          bodyText: 'Your order has shipped.',
          components: {
            buttons: [{ kind: 'url', text: 'Track', url: '' }],
          },
        })
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(RoutaInvalidRequestError)
      const apiError = error as RoutaInvalidRequestError
      expect(apiError.statusCode).toBe(422)
      expect(apiError.code).toBe('template_components_invalid')
      expect(apiError.param).toBe('components.buttons')
    })

    it('422 template_components_invalid — a footer over its limit points at components.footer', async () => {
      const { routa, channel } = channelClient()

      const error = await routa.templates
        .submit({
          channel,
          name: templateName(),
          language: 'en_US',
          category: 'utility',
          bodyText: 'Your order has shipped.',
          components: { footer: { text: 'x'.repeat(200) } },
        })
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(RoutaInvalidRequestError)
      expect((error as RoutaInvalidRequestError).code).toBe(
        'template_components_invalid'
      )
      expect((error as RoutaInvalidRequestError).param).toBe(
        'components.footer'
      )
    })

    it('422 template_name_invalid — param is name', async () => {
      const { routa, channel } = channelClient()

      const error = await routa.templates
        .submit({
          channel,
          name: 'Not A Valid Name!',
          language: 'en_US',
          category: 'utility',
          bodyText: 'Your order has shipped.',
        })
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(RoutaInvalidRequestError)
      expect((error as RoutaInvalidRequestError).statusCode).toBe(422)
      expect((error as RoutaInvalidRequestError).code).toBe(
        'template_name_invalid'
      )
      expect((error as RoutaInvalidRequestError).param).toBe('name')
    })
  }
)
