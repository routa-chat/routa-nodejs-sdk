import { describe, expect, it } from 'vitest'
import { serializeSubmitTemplateParams } from '../../../src/template/submit-template'
import { toTemplateMediaId } from '../../../src/template/template-media-id'

const BASE = {
  channel: 'chan_1',
  name: 'order_shipped',
  language: 'en_US',
  category: 'utility',
  bodyText: 'Your order {{1}} shipped.',
} as const

const WIRE_BASE = {
  channel: 'chan_1',
  name: 'order_shipped',
  language: 'en_US',
  category: 'utility',
  body_text: 'Your order {{1}} shipped.',
} as const

const MEDIA_ID = toTemplateMediaId('tmedia_01J8XA1B2C3D4E5F6G7H8J9K0M')

// The OpenAPI snapshot of 2026-11-21 has the request schema of
// `POST /v1/templates` but no example bodies, so every expectation below is
// built by hand from what that schema allows: `components.header` is
// `{kind:'text', text}` or `{kind:'media', media_id}`, `components.footer` is
// `{text}`, and `components.buttons` items are `{kind:'quick_reply', text}`,
// `{kind:'phone_number', text, phone_number}` or `{kind:'url', text, url}`.

describe('serializeSubmitTemplateParams() — without components', () => {
  it('produces exactly the body it always did, with no components key', () => {
    const body = serializeSubmitTemplateParams(BASE)

    expect(body).toEqual(WIRE_BASE)
    expect(Object.keys(body)).toEqual([
      'channel',
      'name',
      'language',
      'category',
      'body_text',
    ])
  })
})

describe('serializeSubmitTemplateParams() — components', () => {
  it('serializes a text header', () => {
    const body = serializeSubmitTemplateParams({
      ...BASE,
      components: { header: { kind: 'text', text: 'Order update' } },
    })

    expect(body).toEqual({
      ...WIRE_BASE,
      components: { header: { kind: 'text', text: 'Order update' } },
    })
  })

  it('serializes a media header, renaming mediaId to media_id', () => {
    const body = serializeSubmitTemplateParams({
      ...BASE,
      components: { header: { kind: 'media', mediaId: MEDIA_ID } },
    })

    expect(body.components).toEqual({
      header: { kind: 'media', media_id: MEDIA_ID },
    })
    expect(JSON.stringify(body)).not.toContain('mediaId')
  })

  it('serializes a footer', () => {
    const body = serializeSubmitTemplateParams({
      ...BASE,
      components: { footer: { text: 'Reply STOP to opt out' } },
    })

    expect(body.components).toEqual({
      footer: { text: 'Reply STOP to opt out' },
    })
  })

  it('serializes a quick_reply button', () => {
    const body = serializeSubmitTemplateParams({
      ...BASE,
      components: { buttons: [{ kind: 'quick_reply', text: 'Thanks' }] },
    })

    expect(body.components).toEqual({
      buttons: [{ kind: 'quick_reply', text: 'Thanks' }],
    })
  })

  it('serializes a phone_number button, renaming phoneNumber to phone_number', () => {
    const body = serializeSubmitTemplateParams({
      ...BASE,
      components: {
        buttons: [
          {
            kind: 'phone_number',
            text: 'Call us',
            phoneNumber: '+15550001111',
          },
        ],
      },
    })

    expect(body.components).toEqual({
      buttons: [
        { kind: 'phone_number', text: 'Call us', phone_number: '+15550001111' },
      ],
    })
    expect(JSON.stringify(body)).not.toContain('phoneNumber')
  })

  it('serializes a url button, keeping its placeholder', () => {
    const body = serializeSubmitTemplateParams({
      ...BASE,
      components: {
        buttons: [
          {
            kind: 'url',
            text: 'Track',
            url: 'https://example.com/track/{{1}}',
          },
        ],
      },
    })

    expect(body.components).toEqual({
      buttons: [
        { kind: 'url', text: 'Track', url: 'https://example.com/track/{{1}}' },
      ],
    })
  })

  it('serializes header, footer and all three button kinds together, in order', () => {
    const body = serializeSubmitTemplateParams({
      ...BASE,
      components: {
        header: { kind: 'media', mediaId: MEDIA_ID },
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
      },
    })

    expect(body).toEqual({
      ...WIRE_BASE,
      components: {
        header: { kind: 'media', media_id: MEDIA_ID },
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
      },
    })
  })

  it('leaves out a part that was not given, instead of sending undefined', () => {
    const body = serializeSubmitTemplateParams({
      ...BASE,
      components: { footer: { text: 'f' } },
    })

    expect(Object.keys(body.components ?? {})).toEqual(['footer'])
  })

  it('does not validate: it forwards over-long text and too many buttons for the API to judge', () => {
    const long = 'x'.repeat(500)
    const buttons = Array.from({ length: 25 }, () => ({
      kind: 'quick_reply' as const,
      text: long,
    }))

    const body = serializeSubmitTemplateParams({
      ...BASE,
      components: { header: { kind: 'text', text: long }, buttons },
    })

    expect(body.components?.buttons).toHaveLength(25)
    expect(body.components?.header).toEqual({ kind: 'text', text: long })
  })
})
