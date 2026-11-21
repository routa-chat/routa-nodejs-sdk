import type { TemplateMediaId } from './template-media-id'

/**
 * The structured parts of a template, in the shape the API **returns** them.
 * What a caller may send when submitting a template is a separate contract
 * (`TemplateComponentsInput`, in `template-components-input.ts`). Keys stay in
 * the API's own snake_case (`media_id`, `phone_number`), as they do for
 * `MessageContent`, since nothing about them is reshaped on the way out.
 */

/** Which kind of file a media header carries. */
export type TemplateHeaderMediaFormat = 'image' | 'video' | 'document'

/** The header of a template: a line of text, or one media file. */
export type TemplateHeader =
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'media'
      readonly format: TemplateHeaderMediaFormat
      /** The `TemplateMedia` id the header was created from. */
      readonly media_id: TemplateMediaId
    }

/** The small grey line under a template's body. */
export interface TemplateFooter {
  readonly text: string
}

/** A button under a template's body. */
export type TemplateButton =
  | { readonly kind: 'quick_reply'; readonly text: string }
  | {
      readonly kind: 'phone_number'
      readonly text: string
      readonly phone_number: string
    }
  | { readonly kind: 'url'; readonly text: string; readonly url: string }

/**
 * Everything a template has besides its body. Each part is absent when the
 * template does not have it.
 */
export interface TemplateComponents {
  readonly header?: TemplateHeader
  readonly footer?: TemplateFooter
  readonly buttons?: readonly TemplateButton[]
}
