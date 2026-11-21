import type { TemplateMediaId } from './template-media-id'

/**
 * The structured parts of a template, in the shape `templates.submit()`
 * **accepts** them — camelCase, like every other parameter. What comes back
 * is a separate contract (`TemplateComponents`, in `template-components.ts`):
 * it is the API's own snake_case shape and a media header carries its
 * `format`, which the caller never states.
 *
 * Nothing here checks lengths, button counts, URL or phone formats, or
 * WhatsApp's own rules: the API applies them and answers `422` with the
 * field at fault. Only the *shape* is enforced, so a field a kind needs
 * cannot be left out.
 */

/**
 * The header of a template: a line of text, or one media file uploaded with
 * `templates.uploadMedia()`. A union rather than optional fields, so a
 * `media` header without its `mediaId` — or a `text` one without `text` —
 * does not compile.
 */
export type TemplateHeaderInput =
  | {
      readonly kind: 'text'
      /** At most 60 characters and at most one `{{1}}` placeholder; the API enforces it. */
      readonly text: string
    }
  | {
      readonly kind: 'media'
      /**
       * The `id` of a `TemplateMedia` from `templates.uploadMedia()`. Only that
       * id fits: a `MediaId` from `media.upload()` is a different kind of file
       * and does not compile here. The API derives the header's format
       * (`image`, `video`, `document`) from the upload.
       */
      readonly mediaId: TemplateMediaId
    }

/** The small grey line under a template's body. */
export interface TemplateFooterInput {
  /** At most 60 characters; the API enforces it. */
  readonly text: string
}

/** A button under a template's body. Each kind carries exactly the fields it needs. */
export type TemplateButtonInput =
  | {
      readonly kind: 'quick_reply'
      /** The label, at most 25 characters; the API enforces it. */
      readonly text: string
    }
  | {
      readonly kind: 'phone_number'
      readonly text: string
      /** The number the button dials. */
      readonly phoneNumber: string
    }
  | {
      readonly kind: 'url'
      readonly text: string
      /** The destination. It may contain exactly one `{{1}}` placeholder. */
      readonly url: string
    }

/**
 * Everything a template can have besides its body. Each part is optional;
 * leave `components` out of `templates.submit()` altogether for a body-only
 * template.
 */
export interface TemplateComponentsInput {
  readonly header?: TemplateHeaderInput
  readonly footer?: TemplateFooterInput
  /** Up to 10, as the API enforces. */
  readonly buttons?: readonly TemplateButtonInput[]
}
