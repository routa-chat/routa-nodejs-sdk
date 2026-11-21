import { expectTypeOf, test } from 'vitest'
import type {
  Template,
  TemplateFailureCode,
  TemplateOrigin,
  TemplateStatus,
  TemplateUnsupportedComponent,
} from '../../src/template/template'
import type {
  TemplateButton,
  TemplateComponents,
  TemplateHeader,
} from '../../src/template/template-components'
import type { TemplateMediaId } from '../../src/template/template-media-id'

test('TemplateStatus is exhaustively discriminated, failed included', () => {
  function describe(status: TemplateStatus): string {
    switch (status) {
      case 'draft':
      case 'submitted':
      case 'pending':
      case 'approved':
      case 'rejected':
      case 'paused':
      case 'disabled':
      case 'failed':
        return status
      default: {
        const exhaustiveCheck: never = status
        return exhaustiveCheck
      }
    }
  }
  void describe
})

test('TemplateFailureCode and TemplateUnsupportedComponent are closed unions', () => {
  function failure(code: TemplateFailureCode): string {
    switch (code) {
      case 'attempts_exhausted':
      case 'channel_unavailable':
      case 'media_unavailable':
      case 'provider_auth_failed':
      case 'provider_rejected_request':
      case 'provider_unavailable':
        return code
      default: {
        const exhaustiveCheck: never = code
        return exhaustiveCheck
      }
    }
  }
  function unsupported(component: TemplateUnsupportedComponent): string {
    switch (component) {
      case 'carousel':
      case 'catalog':
      case 'copy_code_button':
      case 'flow_button':
      case 'limited_time_offer':
      case 'location_header':
      case 'media_header':
      case 'named_parameters':
      case 'otp_button':
      case 'other':
        return component
      default: {
        const exhaustiveCheck: never = component
        return exhaustiveCheck
      }
    }
  }
  void failure
  void unsupported
})

test('Template exposes the nine response fields', () => {
  expectTypeOf<Template['bodyText']>().toEqualTypeOf<string | null>()
  expectTypeOf<
    Template['failureCode']
  >().toEqualTypeOf<TemplateFailureCode | null>()
  expectTypeOf<Template['failureDetail']>().toEqualTypeOf<string | null>()
  expectTypeOf<Template['deletionRequested']>().toEqualTypeOf<boolean>()
  expectTypeOf<Template['deletionFailureDetail']>().toEqualTypeOf<
    string | null
  >()
  expectTypeOf<Template['origin']>().toEqualTypeOf<TemplateOrigin>()
  expectTypeOf<Template['origin']>().toEqualTypeOf<'routa' | 'provider'>()
  expectTypeOf<Template['readOnly']>().toEqualTypeOf<boolean>()
  expectTypeOf<Template['unsupportedComponents']>().toEqualTypeOf<
    readonly TemplateUnsupportedComponent[]
  >()
})

test('Template.components is absent for a body-only template, so it needs a guard', () => {
  expectTypeOf<Template['components']>().toEqualTypeOf<
    TemplateComponents | undefined
  >()

  function headerKind(template: Template): string | undefined {
    // @ts-expect-error — components may be absent, so `.header` needs a guard first.
    void template.components.header
    return template.components?.header?.kind
  }
  void headerKind
})

test('the read shape of header and buttons discriminates on kind', () => {
  function header(value: TemplateHeader): string {
    switch (value.kind) {
      case 'text':
        return value.text
      case 'media':
        expectTypeOf(value.media_id).toEqualTypeOf<TemplateMediaId>()
        return `${value.format}:${value.media_id}`
      default: {
        const exhaustiveCheck: never = value
        return exhaustiveCheck
      }
    }
  }
  function button(value: TemplateButton): string {
    switch (value.kind) {
      case 'quick_reply':
        return value.text
      case 'phone_number':
        return value.phone_number
      case 'url':
        return value.url
      default: {
        const exhaustiveCheck: never = value
        return exhaustiveCheck
      }
    }
  }
  void header
  void button
})
