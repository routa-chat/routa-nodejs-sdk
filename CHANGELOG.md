# @routa-chat/sdk

## 0.3.0

### Minor Changes

- [#6](https://github.com/routa-chat/routa-nodejs-sdk/pull/6) [`ae1dd04`](https://github.com/routa-chat/routa-nodejs-sdk/commit/ae1dd04ff7627514026b9658bf2d9cf99ec6590c) Thanks [@nathvnfwck](https://github.com/nathvnfwck)! - `Template`, `Message`, events and errors now match the current API contract. Several of these change a public type, and the SDK is 0.x, so this ships as a minor.
  
  **What breaks**
  
  - `TemplateStatus` gains `'failed'` (the template could not be submitted to WhatsApp). A `switch` over it with a `never` check stops compiling until it handles the new member.
  - `EventType` goes from 13 to 17 members: `template.failed`, `template.category_changed`, `template.updated` and `template.deleted` are new, and `RoutaEvent` has a member for each. An exhaustive `switch (event.type)` needs them.
  - New **required** fields on types you read. Reading a `Template`, a `Message` or an event is unaffected; code that *builds* one itself — a test fixture, a mock of the SDK — stops compiling until it supplies them. `Template` gains `bodyText` (`string | null`), `failureCode`, `failureDetail`, `deletionRequested`, `deletionFailureDetail`, `origin`, `readOnly` and `unsupportedComponents` (`components` is optional); `Message` gains `origin` and `failureCode`; every known `RoutaEvent` gains `externalRef`.
  - `RoutaApiError` now also carries `type` and `details`, and `ErrorEnvelope` / `RoutaApiErrorDetails` accept them (both optional — a proxy's response has neither).
  - `402` and `409` responses are no longer a bare `RoutaApiError`. They are `RoutaBillingError` and `RoutaConflictError`, both subclasses of it, so a `catch` on `RoutaApiError` keeps working; only code that matched `error.constructor === RoutaApiError` for these statuses notices. Retry behaviour is unchanged: `402` is never retried, and `409` only for `idempotency_in_progress`.
  
  **What is new**
  
  - `Template`: `bodyText`, `components` (header, footer, buttons — the shape the API returns), `failureCode`, `failureDetail`, `deletionRequested`, `deletionFailureDetail`, `origin`, `readOnly` and `unsupportedComponents`. `readOnly: true` / `origin: 'provider'` is a template imported from WhatsApp, which this SDK cannot edit. `components` is absent, not empty, for a body-only template.
  - `Message`: `origin` (`'api' | 'business_app' | null`) and `failureCode` (`string | null`).
  - Events: `externalRef`, the project's `external_ref`.
  - `RoutaBillingError` (`limit`, `used`, `resetsAt` — each only for the codes that define it) and `RoutaConflictError` (`reason`).
  - Newly exported types: `MessageOrigin`, `TemplateFailureCode`, `TemplateOrigin`, `TemplateUnsupportedComponent`, `TemplateComponents`, `TemplateHeader`, `TemplateFooter`, `TemplateButton`, `TemplateHeaderMediaFormat` and `RoutaErrorDetailValues`.
  
  **Migrating**
  
  ```ts
  switch (template.status) {
    // ...existing cases...
    case 'failed':
      console.error(template.failureCode, template.failureDetail)
      break
  }
  
  if (template.components?.buttons) {
    // `components` may be absent: guard it before reading header, footer or buttons.
  }
  
  try {
    await routa.messages.send(params)
  } catch (error) {
    if (error instanceof RoutaBillingError) {
      // Out of free messages or plan allowance — stop sending.
      console.error(error.code, error.used, error.limit)
    }
    throw error
  }
  ```

- [#6](https://github.com/routa-chat/routa-nodejs-sdk/pull/6) [`5eeaa82`](https://github.com/routa-chat/routa-nodejs-sdk/commit/5eeaa825434091adef2dc320fd5013ed106c9e80) Thanks [@nathvnfwck](https://github.com/nathvnfwck)! - Upload de mídia: `routa.media.upload()`.
  
  **What is new**
  
  - `routa.media.upload()` stores a file in Routa (`POST /v1/media`, scope `media:write`) and returns a `Media`. It takes either `{ file: Blob | Uint8Array, contentType: string }`, which sends the bytes as the request body, or `{ sourceUrl: string }`, which has Routa download a URL. The two modes are a union, so mixing them or leaving out `contentType` does not compile. The SDK checks neither size nor type: a refused upload throws `RoutaInvalidRequestError` (`422`, with a `media_*` code such as `media_content_type_rejected` or `media_size_limit_exceeded`), and an oversized body throws a base `RoutaApiError` with status `413`. `POST /v1/media` ignores `Idempotency-Key`, so a retry after a lost response can store the file twice — set `maxRetries: 0` to avoid that. `messages.send()` still does not accept media.
  - `TemplateMedia` and `TemplateMediaId` (`tmedia_…`, with `isTemplateMediaId` and `toTemplateMediaId`), the shape `POST /v1/templates/media` returns. `routa.templates.uploadMedia()`, which produces it, is described with the template components below.
  - `HttpResponse` now has `status`, the HTTP status of the successful response.
  - `UploadMediaParams`, `UploadMediaFileParams`, `UploadMediaUrlParams` are exported.
  
  **What breaks**
  
  - Anything that implements the internal `HttpClient` interface — a test double or mock of the transport — must now return `status` from `requestWithHeaders()`, because `HttpResponse.status` is required. The interface is not exported from the package, so code that only calls `routa.*` is not affected.

- [#6](https://github.com/routa-chat/routa-nodejs-sdk/pull/6) [`cd356b7`](https://github.com/routa-chat/routa-nodejs-sdk/commit/cd356b70d8cd8b15399613ec7684464931c9141d) Thanks [@nathvnfwck](https://github.com/nathvnfwck)! - Partner API (experimental): `RoutaPartner`, em um subpath novo, `@routa-chat/sdk/partner`.
  
  **What is new**
  
  - `import { RoutaPartner } from '@routa-chat/sdk/partner'` — the client of the Partner API, for a platform that resells WhatsApp and provisions one project per customer. It is a separate entry point on purpose: a partner key reaches every customer of the partner, so importing it is a visible act, and `Routa` loads none of it. **Experimental**: it may change in a minor release until an external partner has used it.
  - `new RoutaPartner({ partnerKey })`, or just `new RoutaPartner('rt_partner_…')` (the same shorthand `new Routa(apiKey)` has) — the credential is `partnerKey` (`rt_partner_…`), never `apiKey`; a project API key is refused locally with a message that points to `Routa`. The other options (`baseURL`, `timeout`, `maxRetries`, `logger`, `fetch`) are the same as `Routa`'s.
  - `partner.projects` (`create`, `list`, `retrieve`, `update`, `delete`), `partner.projects.apiKeys` (`create`, `rotate`, `revoke`), `partner.channels` (`list`, `delete`) and `partner.webhook` (`retrieve`, `set`, `rotateSecret`) — the 13 `/v1/partner/*` routes. `projects.create()` returns `{ project, created }` (`created` is the `201`-versus-`200` of a repeated `externalRef`); `projects.delete()` returns `{ status: 'deleted' }` or `{ status: 'deleting', projectId }` (call again until `deleted`); `retrieve()` carries the project's channels, which is how a partner confirms an onboarding. `list()` of projects and channels is cursor-paginated and iterable, like the root's. The API key secret and the webhook secret come back once, on the `…WithSecret` types.
  - `buildOnboardingLink()` — builds and signs (HMAC-SHA256 over the canonical string of ADR-0097) the link a customer opens to connect their number. Pure, Web Crypto only, checked against the backend's test vectors. It validates its input and throws on what the API would refuse silently: the API answers every bad link with the same "this link is not valid", so this is the only place the developer learns why. Sign when the customer clicks: a link is good for 10 minutes.
  - Ids: `PartnerProjectId` and `ApiKeyId`, with `is…`/`to…` helpers.
  - `RoutaPartner` throws the same error classes as `Routa`, from one shared copy: `error instanceof RoutaApiError` (imported from `@routa-chat/sdk`) holds for an error it throws, in ESM and in CJS. `404 partner_api_not_available` (the plan has no Partner API) is a `RoutaInvalidRequestError`.
  - `package.json` gets `exports["./partner"]` and a `typesVersions` entry, so the subpath also resolves under `moduleResolution: node10`.
  
  **What breaks**
  
  - `new Routa('rt_partner_…')` now throws synchronously, with a message that points to `RoutaPartner`. A partner key is accepted only by `/v1/partner/*`, so a `Routa` built on one answered `401` to every call; nothing that worked is affected.

- [#6](https://github.com/routa-chat/routa-nodejs-sdk/pull/6) [`09f240b`](https://github.com/routa-chat/routa-nodejs-sdk/commit/09f240b0a3cc455100365c784a7a5525f2344b31) Thanks [@nathvnfwck](https://github.com/nathvnfwck)! - Templates com componentes: `components` em `routa.templates.submit()` e `routa.templates.uploadMedia()`.
  
  **What is new**
  
  - `templates.submit()` accepts `components`: a header (`{ kind: 'text', text }` or `{ kind: 'media', mediaId }`), a footer (`{ text }`) and up to 10 buttons (`quick_reply`, `phone_number` with `phoneNumber`, `url` with `url`). Each is a union by `kind`, so a `url` button without its `url`, or a `media` header without its `mediaId`, does not compile. `mediaId` is a `TemplateMediaId`: a plain string or a `MediaId` from `media.upload()` does not fit. Without `components` the request is exactly what it was. The SDK checks only the shape; lengths, button counts, URL and phone formats and WhatsApp's rules are the API's, which answers `RoutaInvalidRequestError` (`422`, `template_components_invalid` with `param` `components.header`, `components.footer` or `components.buttons` — the component, not the item inside it).
  - `templates.uploadMedia()` stores a template header file (`POST /v1/templates/media`, scope `templates:write`) and returns a `TemplateMedia`. It takes `{ file: Blob | Uint8Array, contentType: string }` — bytes only, no `sourceUrl`. Every refusal is `422 template_media_invalid`; a body over 100 MiB is a base `RoutaApiError` with status `413`.
  - A `mediaId` that is not in the project is `404 template_media_not_found` (`RoutaInvalidRequestError`).
  - `submit()` answers with `status: 'submitted'`, not `approved`: follow the `template.*` events for the outcome. Neither `submit()` nor `uploadMedia()` reads `Idempotency-Key`, so a retry after a lost response can create a second template or store the file twice — set `maxRetries: 0` to avoid that.
  - `TemplateHeaderInput`, `TemplateFooterInput`, `TemplateButtonInput`, `TemplateComponentsInput` and `UploadTemplateMediaParams` are exported. The types that describe a template you read (`TemplateHeader`, `TemplateFooter`, `TemplateButton`, `TemplateComponents`, introduced by the contract update above) keep the API's snake_case; the `Input` ones are camelCase.
  - In a template you read, a media header's `media_id` is a `TemplateMediaId` (a string at runtime), so it can be passed back as a `mediaId`.

## 0.2.0

### Minor Changes

- [`f17fdc9`](https://github.com/routa-chat/routa-nodejs-sdk/commit/f17fdc9757ad38bf24190e2636261891fabc8dba) Thanks [@nathvnfwck](https://github.com/nathvnfwck)! - `Message['content']` is now `MessageContent | null`, and `Message` has a new `contentRedactedAt: string | null`.
  
  Routa removes message content once it is older than the retention period of the plan, and returns `content: null` with a `content_redacted_at` timestamp for those messages. Before this change, `messages.retrieve()` and `messages.list()` threw `TypeError: Cannot read properties of null` on such a message, so one old message broke a whole listing. They now return it, with the rest of the message intact.
  
  This is a breaking change to the type, and the SDK is 0.x, so it ships as a minor. Code that reads `message.content` without a check stops compiling. To migrate, guard the read:
  
  ```ts
  if (message.content) {
    // use message.content
  }
  ```
