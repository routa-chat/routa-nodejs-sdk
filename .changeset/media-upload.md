---
'@routa-chat/sdk': minor
---

Upload de mídia: `routa.media.upload()`.

**What is new**

- `routa.media.upload()` stores a file in Routa (`POST /v1/media`, scope `media:write`) and returns a `Media`. It takes either `{ file: Blob | Uint8Array, contentType: string }`, which sends the bytes as the request body, or `{ sourceUrl: string }`, which has Routa download a URL. The two modes are a union, so mixing them or leaving out `contentType` does not compile. The SDK checks neither size nor type: a refused upload throws `RoutaInvalidRequestError` (`422`, with a `media_*` code such as `media_content_type_rejected` or `media_size_limit_exceeded`), and an oversized body throws a base `RoutaApiError` with status `413`. `POST /v1/media` ignores `Idempotency-Key`, so a retry after a lost response can store the file twice — set `maxRetries: 0` to avoid that. `messages.send()` still does not accept media.
- `TemplateMedia` and `TemplateMediaId` (`tmedia_…`), the shape `POST /v1/templates/media` returns. Types only for now: the upload method comes with the template components work.
- `HttpResponse` now has `status`, the HTTP status of the successful response.
- `UploadMediaParams`, `UploadMediaFileParams`, `UploadMediaUrlParams` are exported.

**What breaks**

- Anything that implements the internal `HttpClient` interface — a test double or mock of the transport — must now return `status` from `requestWithHeaders()`, because `HttpResponse.status` is required. The interface is not exported from the package, so code that only calls `routa.*` is not affected.
