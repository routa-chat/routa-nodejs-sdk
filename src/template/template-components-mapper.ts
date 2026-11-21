import type {
  TemplateButton,
  TemplateComponents,
  TemplateFooter,
  TemplateHeader,
  TemplateHeaderMediaFormat,
} from './template-components'
import { toTemplateMediaId } from './template-media-id'

/** Wire shape of a template header: identical to `TemplateHeader`, except that a media id is a plain string. */
export type RawTemplateHeader =
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'media'
      readonly format: TemplateHeaderMediaFormat
      readonly media_id: string
    }

/** Wire shape of a template's `components`, before the media id is branded. */
export interface RawTemplateComponents {
  readonly header?: RawTemplateHeader | undefined
  readonly footer?: TemplateFooter | undefined
  readonly buttons?: readonly TemplateButton[] | undefined
}

function parseHeader(raw: RawTemplateHeader): TemplateHeader {
  switch (raw.kind) {
    case 'text':
      return raw
    case 'media':
      return {
        kind: 'media',
        format: raw.format,
        media_id: toTemplateMediaId(raw.media_id),
      }
  }
}

/**
 * Turns the API's `components` into `TemplateComponents`: the only change is
 * branding a media header's id. A part the API did not send stays absent.
 */
export function parseTemplateComponents(
  raw: RawTemplateComponents
): TemplateComponents {
  return {
    ...(raw.header !== undefined ? { header: parseHeader(raw.header) } : {}),
    ...(raw.footer !== undefined ? { footer: raw.footer } : {}),
    ...(raw.buttons !== undefined ? { buttons: raw.buttons } : {}),
  }
}
