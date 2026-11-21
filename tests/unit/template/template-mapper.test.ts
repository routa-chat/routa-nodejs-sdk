import { describe, expect, it } from 'vitest'
import type {
  TemplateFailureCode,
  TemplateUnsupportedComponent,
} from '../../../src/template/template'
import {
  parseTemplate,
  type RawTemplate,
} from '../../../src/template/template-mapper'

// Wire bodies shaped like the items of `GET /v1/templates` and the body of
// `GET /v1/templates/{id}` in the OpenAPI snapshot of 2026-11-21 (the
// snapshot carries schemas, not example bodies, so each field is filled in
// by hand with a value its schema allows). The `required` list there has
// every field below except `components`, which the backend omits for a
// body-only template ("never an empty object").

function rawTemplate(overrides: Partial<RawTemplate> = {}): RawTemplate {
  return {
    id: 'tmpl_01J8XA1B2C3D4E5F6G7H8J9K0M',
    channel: 'chan_01J8XA1B2C3D4E5F6G7H8J9K0M',
    name: 'order_confirmation',
    language: 'en_US',
    category: 'utility',
    body_text: 'Your order {{1}} shipped on {{2}}.',
    variables: [{ index: 1 }, { index: 2 }],
    status: 'approved',
    rejection_reason: null,
    failure_code: null,
    failure_detail: null,
    deletion_requested: false,
    deletion_failure_detail: null,
    origin: 'routa',
    read_only: false,
    unsupported_components: [],
    created_at: '2026-11-01T12:00:00.000Z',
    updated_at: '2026-11-02T12:00:00.000Z',
    ...overrides,
  }
}

describe('parseTemplate() — body_text', () => {
  it('exposes the body as bodyText', () => {
    expect(parseTemplate(rawTemplate()).bodyText).toBe(
      'Your order {{1}} shipped on {{2}}.'
    )
  })

  it('keeps bodyText null for an imported template Routa cannot reproduce', () => {
    const template = parseTemplate(
      rawTemplate({ body_text: null, origin: 'provider', read_only: true })
    )

    expect(template.bodyText).toBeNull()
  })
})

describe('parseTemplate() — components (read shape)', () => {
  it('leaves components absent for a body-only template, never an empty object', () => {
    const template = parseTemplate(rawTemplate())

    expect('components' in template).toBe(false)
    expect(template.components).toBeUndefined()
  })

  it('passes a text header, footer and every button kind through', () => {
    const components = {
      header: { kind: 'text', text: 'Order update' },
      footer: { text: 'Reply STOP to opt out' },
      buttons: [
        { kind: 'quick_reply', text: 'Thanks' },
        { kind: 'phone_number', text: 'Call us', phone_number: '+15550001111' },
        { kind: 'url', text: 'Track', url: 'https://example.com/track' },
      ],
    } as const

    const template = parseTemplate(rawTemplate({ components }))

    expect(template.components).toEqual(components)
  })

  it.each(['image', 'video', 'document'] as const)(
    'passes a %s media header through with its format and media_id',
    format => {
      const header = {
        kind: 'media',
        format,
        media_id: 'tmed_01J8XA1B2C3D4E5F6G7H8J9K0M',
      } as const

      const template = parseTemplate(rawTemplate({ components: { header } }))

      expect(template.components?.header).toEqual(header)
    }
  )
})

describe('parseTemplate() — status failed and failure fields', () => {
  it('reads a failed template with its failure_code and failure_detail', () => {
    const template = parseTemplate(
      rawTemplate({
        status: 'failed',
        failure_code: 'provider_rejected_request',
        failure_detail: 'The name may only contain lowercase letters.',
      })
    )

    expect(template.status).toBe('failed')
    expect(template.failureCode).toBe('provider_rejected_request')
    expect(template.failureDetail).toBe(
      'The name may only contain lowercase letters.'
    )
  })

  it.each<TemplateFailureCode>([
    'attempts_exhausted',
    'channel_unavailable',
    'media_unavailable',
    'provider_auth_failed',
    'provider_rejected_request',
    'provider_unavailable',
  ])('accepts the failure code %s', code => {
    expect(
      parseTemplate(rawTemplate({ status: 'failed', failure_code: code }))
        .failureCode
    ).toBe(code)
  })

  it('keeps failureCode and failureDetail null while the template has not failed', () => {
    const template = parseTemplate(rawTemplate())

    expect(template.failureCode).toBeNull()
    expect(template.failureDetail).toBeNull()
  })
})

describe('parseTemplate() — deletion fields', () => {
  it('reads a template whose deletion was requested', () => {
    const template = parseTemplate(rawTemplate({ deletion_requested: true }))

    expect(template.deletionRequested).toBe(true)
    expect(template.deletionFailureDetail).toBeNull()
  })

  it('reads why the last deletion did not happen', () => {
    const template = parseTemplate(
      rawTemplate({
        deletion_requested: false,
        deletion_failure_detail: 'The number can no longer reach WhatsApp.',
      })
    )

    expect(template.deletionRequested).toBe(false)
    expect(template.deletionFailureDetail).toBe(
      'The number can no longer reach WhatsApp.'
    )
  })
})

describe('parseTemplate() — origin, readOnly and unsupportedComponents', () => {
  it('reads a template submitted through Routa as editable by origin', () => {
    const template = parseTemplate(rawTemplate())

    expect(template.origin).toBe('routa')
    expect(template.readOnly).toBe(false)
    expect(template.unsupportedComponents).toEqual([])
  })

  it('reads an imported WhatsApp template as read-only with the reasons', () => {
    const unsupported: TemplateUnsupportedComponent[] = [
      'carousel',
      'named_parameters',
    ]

    const template = parseTemplate(
      rawTemplate({
        origin: 'provider',
        read_only: true,
        body_text: null,
        unsupported_components: unsupported,
      })
    )

    expect(template.origin).toBe('provider')
    expect(template.readOnly).toBe(true)
    expect(template.unsupportedComponents).toEqual(unsupported)
  })

  it.each<TemplateUnsupportedComponent>([
    'carousel',
    'catalog',
    'copy_code_button',
    'flow_button',
    'limited_time_offer',
    'location_header',
    'media_header',
    'named_parameters',
    'otp_button',
    'other',
  ])('accepts the unsupported component %s', component => {
    expect(
      parseTemplate(rawTemplate({ unsupported_components: [component] }))
        .unsupportedComponents
    ).toEqual([component])
  })
})

describe('parseTemplate() — fields that already existed', () => {
  it('still maps id, names and timestamps', () => {
    const template = parseTemplate(rawTemplate())

    expect(template).toMatchObject({
      id: 'tmpl_01J8XA1B2C3D4E5F6G7H8J9K0M',
      channel: 'chan_01J8XA1B2C3D4E5F6G7H8J9K0M',
      name: 'order_confirmation',
      language: 'en_US',
      category: 'utility',
      variables: [{ index: 1 }, { index: 2 }],
      rejectionReason: null,
      createdAt: '2026-11-01T12:00:00.000Z',
      updatedAt: '2026-11-02T12:00:00.000Z',
    })
  })
})
