---
'@routa-chat/sdk': minor
---

Templates com componentes: `components` em `routa.templates.submit()` e `routa.templates.uploadMedia()`.

**What is new**

- `templates.submit()` accepts `components`: a header (`{ kind: 'text', text }` or `{ kind: 'media', mediaId }`), a footer (`{ text }`) and up to 10 buttons (`quick_reply`, `phone_number` with `phoneNumber`, `url` with `url`). Each is a union by `kind`, so a `url` button without its `url`, or a `media` header without its `mediaId`, does not compile. `mediaId` is a `TemplateMediaId`: a plain string or a `MediaId` from `media.upload()` does not fit. Without `components` the request is exactly what it was. The SDK checks only the shape; lengths, button counts, URL and phone formats and WhatsApp's rules are the API's, which answers `RoutaInvalidRequestError` (`422`, `template_components_invalid` with `param` `components.header`, `components.footer` or `components.buttons` — the component, not the item inside it).
- `templates.uploadMedia()` stores a template header file (`POST /v1/templates/media`, scope `templates:write`) and returns a `TemplateMedia`. It takes `{ file: Blob | Uint8Array, contentType: string }` — bytes only, no `sourceUrl`. Every refusal is `422 template_media_invalid`; a body over 100 MiB is a base `RoutaApiError` with status `413`.
- A `mediaId` that is not in the project is `404 template_media_not_found` (`RoutaInvalidRequestError`).
- `submit()` answers with `status: 'submitted'`, not `approved`: follow the `template.*` events for the outcome. Neither `submit()` nor `uploadMedia()` reads `Idempotency-Key`, so a retry after a lost response can create a second template or store the file twice — set `maxRetries: 0` to avoid that.
- `TemplateHeaderInput`, `TemplateFooterInput`, `TemplateButtonInput`, `TemplateComponentsInput` and `UploadTemplateMediaParams` are exported. The types that describe a template you read (`TemplateHeader`, `TemplateFooter`, `TemplateButton`, `TemplateComponents`, introduced by the contract update above) keep the API's snake_case; the `Input` ones are camelCase.
- In a template you read, a media header's `media_id` is a `TemplateMediaId` (a string at runtime), so it can be passed back as a `mediaId`.
