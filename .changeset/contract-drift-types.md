---
'@routa-chat/sdk': minor
---

`Template`, `Message`, events and errors now match the current API contract. Several of these change a public type, and the SDK is 0.x, so this ships as a minor.

**What breaks**

- `TemplateStatus` gains `'failed'` (the template could not be submitted to WhatsApp). A `switch` over it with a `never` check stops compiling until it handles the new member.
- `EventType` goes from 13 to 17 members: `template.failed`, `template.category_changed`, `template.updated` and `template.deleted` are new, and `RoutaEvent` has a member for each. An exhaustive `switch (event.type)` needs them.
- `RoutaApiError` now also carries `type` and `details`, and `ErrorEnvelope` / `RoutaApiErrorDetails` accept them (both optional — a proxy's response has neither).
- `402` and `409` responses are no longer a bare `RoutaApiError`. They are `RoutaBillingError` and `RoutaConflictError`, both subclasses of it, so a `catch` on `RoutaApiError` keeps working; only code that matched `error.constructor === RoutaApiError` for these statuses notices. Retry behaviour is unchanged: `402` is never retried, and `409` only for `idempotency_in_progress`.

**What is new**

- `Template`: `bodyText`, `components` (header, footer, buttons — the shape the API returns), `failureCode`, `failureDetail`, `deletionRequested`, `deletionFailureDetail`, `origin`, `readOnly` and `unsupportedComponents`. `readOnly: true` / `origin: 'provider'` is a template imported from WhatsApp, which this SDK cannot edit. `components` is absent, not empty, for a body-only template.
- `Message`: `origin` (`'api' | 'business_app' | null`) and `failureCode` (`string | null`).
- Events: `externalRef`, the project's `external_ref`.
- `RoutaBillingError` (`limit`, `used`, `resetsAt` — each only for the codes that define it) and `RoutaConflictError` (`reason`).

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
