---
'@routa-chat/sdk': minor
---

Partner API (experimental): `RoutaPartner`, em um subpath novo, `@routa-chat/sdk/partner`.

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
