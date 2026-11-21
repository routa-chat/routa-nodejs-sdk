# @routa-chat/sdk

<!--
  Badges. Only the license and Node badges work today.
  Enable the other two once they can resolve:
    - npm version: after the first publish of @routa-chat/sdk
    - CI status:   after .github/workflows/ci.yml exists and has run green once

  [![npm version](https://img.shields.io/npm/v/@routa-chat/sdk.svg)](https://www.npmjs.com/package/@routa-chat/sdk)
  [![CI](https://github.com/routa-chat/routa-nodejs-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/routa-chat/routa-nodejs-sdk/actions/workflows/ci.yml)
-->

[![License: MIT](https://img.shields.io/github/license/routa-chat/routa-nodejs-sdk.svg)](https://github.com/routa-chat/routa-nodejs-sdk/blob/master/LICENSE)
![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)

The official TypeScript SDK for [Routa](https://github.com/routa-chat) — send WhatsApp messages and receive delivery events through one typed client.

## Installation

```bash
npm install @routa-chat/sdk
```

```bash
pnpm add @routa-chat/sdk
# or
yarn add @routa-chat/sdk
```

## Quickstart

```ts
import { Routa } from '@routa-chat/sdk'

const routa = new Routa({ apiKey: 'rt_live_...' })

const message = await routa.messages.send({
  channel: 'chan_...', // a channel you connected in the Routa dashboard
  to: '+5581999999999', // recipient, E.164 (leading + is optional — '5581999999999' also works)
  text: 'Olá! Seu pedido foi confirmado.',
})

console.log(message.id, message.status) // "msg_...", "accepted"
```

`status: 'accepted'` means Routa received the message, **not** that it reached the recipient. Delivery is asynchronous: the message moves through `sent` → `delivered` → `read` (or `failed`), and you learn about each step through [webhooks](#webhooks) or `routa.events.list()`.

To send an approved template instead of free text, pass `template` in place of `text`:

```ts
await routa.messages.send({
  channel: 'chan_...',
  to: '+5581999999999',
  template: { id: 'tmpl_...', bodyParameters: ['Ana', '#1234'] },
})
```

`text` and `template` are mutually exclusive — passing both is a compile error.

## Authentication

Every request is authenticated with an API key, sent as `Authorization: Bearer <key>`. Create keys in the Routa dashboard under **Settings → API keys**; a key is shown only once, when it is created.

Keys look like `rt_live_…` or `rt_test_…`. The prefix follows the environment of the project the key belongs to:

- **`rt_live_`** — a live project.
- **`rt_test_`** — a test project. It runs the same code paths as a live project; the differences are in what it is allowed to connect and in whether it is billed.

Keep keys out of source control and read them from the environment. The client does not read environment variables on its own, so pass the value in:

```ts
import { Routa } from '@routa-chat/sdk'

const apiKey = process.env['ROUTA_API_KEY']
if (!apiKey) {
  throw new Error('ROUTA_API_KEY is not set')
}

const routa = new Routa({ apiKey })
```

`new Routa('rt_live_...')` is shorthand for `new Routa({ apiKey: 'rt_live_...' })`. An empty key throws immediately, at construction, rather than on the first request. To check a key without side effects, call `routa.whoami()`; it returns the organization, project and scopes the key holds.

## Examples

### Retrieve a message

Resource ids are *branded* types: a `MessageId` is a string at runtime, but a plain `string` is not assignable to it, so `retrieve('msg_...')` does not compile. Convert with `toMessageId`, or validate untrusted input first with `isMessageId`:

```ts
import { isMessageId, toMessageId } from '@routa-chat/sdk'

// An id you already trust, such as one you stored from a previous send:
const message = await routa.messages.retrieve(toMessageId('msg_01J8XXXXXXXXXXXXXXXXXXXXXX'))
console.log(message.status, message.deliveredAt)

// An id from user input or a URL — check its shape before using it:
function lookUp(id: string) {
  if (!isMessageId(id)) {
    throw new Error(`Not a message id: ${id}`)
  }
  return routa.messages.retrieve(id)
}
```

`toMessageId` only casts; it does not validate. The same pair exists for every id type (`toChannelId`, `toTemplateId`, `toWebhookId`, …). The ids that `send()` and the list methods return are already branded.

### Paginate a list

`messages.list()` and `events.list()` return an async iterable that fetches further pages for you:

```ts
for await (const message of routa.messages.list({ direction: 'inbound', limit: 50 })) {
  const text = message.content?.type === 'text' ? message.content.body : null
  console.log(message.id, message.from, text)
}
```

`message.content` is `null` once Routa removes it under your plan's [retention period](#message-content-retention); `message.contentRedactedAt` then holds the moment it was removed.

To control paging yourself, ask for one page at a time:

```ts
const page = await routa.messages.list({ limit: 20 }).page()
console.log(page.data.length, page.hasMore, page.nextCursor)
```

### Message content retention

Routa keeps message content for the number of days your plan includes, then removes it. The rest of the message stays: id, status, timestamps, addresses and `metadata`. A message whose content was removed has `content: null` and a `contentRedactedAt` timestamp, and it is returned by `retrieve()` and `list()` like any other, so guard `content` before reading it:

```ts
import { toMessageId } from '@routa-chat/sdk'

const message = await routa.messages.retrieve(toMessageId('msg_01J8XXXXXXXXXXXXXXXXXXXXXX'))

if (message.content) {
  console.log(message.content.type)
} else {
  console.log(`Content removed at ${message.contentRedactedAt}`)
}
```

Removal cannot be undone, and events (`message.*`) are not affected: they carry the message as it was when the event happened.

### Upload media

`routa.media.upload()` stores a file in Routa and returns a `Media`. Send the bytes yourself, with their content type:

```ts
import { readFile } from 'node:fs/promises'

const media = await routa.media.upload({
  file: await readFile('./photo.png'), // a Uint8Array (a Buffer is one) or a Blob
  contentType: 'image/png',
})
console.log(media.id, media.status) // med_… 'ready'
```

Or give Routa a URL to download and re-host:

```ts
const media = await routa.media.upload({ sourceUrl: 'https://example.com/photo.png' })
```

The upload is synchronous: the returned `Media` is already `ready` and has a signed `url` (valid for 15 minutes; `routa.media.retrieve(media.id)` issues a fresh one). The API key needs the `media:write` scope. The mode is a choice, not a mix: `file` always comes with `contentType`, and `sourceUrl` comes alone — anything else does not compile. `contentType` is what tells the API the type; a `Blob`'s own `type` is not read. Streams are not accepted, only a whole `Uint8Array` or `Blob`.

**`messages.send()` does not accept media yet.** The upload is useful today to keep the `id`, but no message method in this SDK sends it.

The SDK checks neither size nor type; the API does, and a refused upload throws a `RoutaInvalidRequestError` with status `422`. Its `code` says why:

| `code` | Meaning |
| --- | --- |
| `media_content_type_rejected` | `contentType` is not a supported type, or the file's first bytes do not match it (a PNG declared as `image/jpeg`). |
| `media_size_limit_exceeded` | The file is over its type's cap: 5 MiB for JPEG and PNG, 500 KiB for WebP, 16 MiB for video and audio, 100 MiB for documents. |
| `media_source_url_invalid` | `sourceUrl` is empty or not a usable URL. |
| `media_source_blocked` | `sourceUrl` points at an address Routa will not fetch from, such as a private network. |
| `media_source_unreachable` | Routa could not download `sourceUrl`. |

```ts
import { RoutaInvalidRequestError } from '@routa-chat/sdk'

try {
  await routa.media.upload({ file: bytes, contentType: 'image/png' })
} catch (error) {
  if (error instanceof RoutaInvalidRequestError && error.code === 'media_size_limit_exceeded') {
    // Resize or compress, then try again.
  } else {
    throw error
  }
}
```

A body larger than the endpoint's ceiling (100 MiB) is refused before it is read, with status `413` and code `payload_too_large`. There is no dedicated class for it, so it arrives as a plain `RoutaApiError`.

An upload is **not idempotent**: `POST /v1/media` ignores `Idempotency-Key`, so the SDK sends none. Like every request, it is retried after a network failure or a `5xx`; if the first attempt had stored the file and only the response was lost, the retry stores it again under a new `id`. Set `maxRetries: 0` if you would rather risk a failed upload than a duplicate.

### Create a template

`routa.templates.submit()` sends a template to WhatsApp for review. Besides the body it takes `components`: a header (text, or an image, video or document), a footer, and up to 10 buttons. Leave `components` out for a body-only template.

To use an image as the header, upload it first with `routa.templates.uploadMedia()`, then reference its `id`:

```ts
import { readFile } from 'node:fs/promises'

const media = await routa.templates.uploadMedia({
  file: await readFile('./header.png'), // a Uint8Array (a Buffer is one) or a Blob
  contentType: 'image/png',
})

const template = await routa.templates.submit({
  channel: 'chan_...',
  name: 'order_shipped',
  language: 'en_US',
  category: 'utility',
  bodyText: 'Your order has shipped.',
  components: {
    header: { kind: 'media', mediaId: media.id },
    footer: { text: 'Reply STOP to opt out' },
    buttons: [
      { kind: 'quick_reply', text: 'Thanks' },
      { kind: 'url', text: 'Track', url: 'https://example.com/track' },
    ],
  },
})
console.log(template.id, template.status) // tmpl_… 'submitted'
```

The answer is `submitted`, **not** `approved`: Routa records the template and sends it to WhatsApp afterwards, and WhatsApp decides later. Follow the `template.*` events — see [Webhooks](#webhooks) — to learn when it becomes `approved`, `rejected` or `failed`. A template that ends up `failed` (read `failureCode`) can only be corrected in the dashboard.

Header, footer and buttons are typed by `kind`, so a field a kind needs cannot be left out:

| Component | Shape |
| --- | --- |
| Header, text | `{ kind: 'text', text }` |
| Header, media | `{ kind: 'media', mediaId }` — the `id` of a `TemplateMedia` from `uploadMedia()`. A `MediaId` from `media.upload()` does not compile here |
| Footer | `{ text }` |
| Button, quick reply | `{ kind: 'quick_reply', text }` |
| Button, phone | `{ kind: 'phone_number', text, phoneNumber }` |
| Button, link | `{ kind: 'url', text, url }` |

A template you read back (`submit()`, `retrieve()`, `list()`) carries the same parts in `template.components`, in the API's own field names (`media_id`, `phone_number`), and a media header also has its `format` (`image`, `video` or `document`), which the API derives from the upload. `components` is absent for a body-only template.

`uploadMedia()` needs the `templates:write` scope, like `submit()`. Its `contentType` is `image/jpeg` or `image/png` (up to 5 MiB), `video/mp4` (16 MiB) or `application/pdf` (100 MiB); the API derives the header format from it. Unlike `media.upload()` it takes bytes only, no `sourceUrl`.

The SDK checks only the shape, not the rules: lengths, the number of buttons, URL and phone formats, the name and the body are judged by the API, which answers `RoutaInvalidRequestError` with status `422`:

| `code` | `param` | Meaning |
| --- | --- | --- |
| `template_name_invalid` | `name` | The name breaks WhatsApp's naming rules. |
| `template_components_invalid` | `body_text`, `components.header`, `components.footer` or `components.buttons` | A component breaks a rule. `param` names the component, not the item inside it (there is no `components.buttons.0.url`): the `message` says what is wrong, and only the first problem found is reported. |
| `template_variables_invalid`, `capability_unsupported` | — | The body's placeholders are not valid, or the channel cannot send templates. |
| `template_media_invalid` (from `uploadMedia()`) | — | `contentType` is not supported, the file's first bytes do not match it, or it is over its type's cap. |

A `mediaId` that does not exist in your project — including one uploaded in another project — is `404 template_media_not_found`, also a `RoutaInvalidRequestError`. The API checks the channel first, so an unknown channel answers `404 channel_not_found` whatever the `mediaId`.

Neither `submit()` nor `uploadMedia()` is idempotent: these routes ignore `Idempotency-Key`, so the SDK sends none. Like every request, they are retried after a network failure or a `5xx`; if the first attempt had gone through and only the response was lost, the retry creates a second template (a new `tmpl_…` with the same name) or stores the file again. Set `maxRetries: 0` if you would rather risk a failed call than a duplicate, and `list()` the templates before resubmitting after an error you could not read.

Editing, deleting and syncing templates are not available: the API offers them only to a logged-in dashboard session, not to an API key.

### Webhooks

Register an HTTPS endpoint and keep the signing secret. It is returned once, when the webhook is created (and again when you rotate it):

```ts
const webhook = await routa.webhooks.create({
  url: 'https://example.com/webhooks/routa',
  subscribedTypes: ['message.*'],
})

console.log(webhook.id, webhook.secret) // store `secret` securely
```

Routa signs every delivery in a `Routa-Signature` header. `constructEvent` verifies it and returns a typed event; it makes no network call. Pass it the **raw request body** exactly as received. Parsing the body and re-serializing it changes the bytes and the signature will not match.

```ts
import { Routa, RoutaSignatureVerificationError } from '@routa-chat/sdk'

const routa = new Routa({ apiKey: 'rt_live_...' })
const signingSecret = 'whsec_...' // the `secret` returned by webhooks.create()

// Works with any framework that gives you a Fetch API `Request`.
export async function handleWebhook(request: Request): Promise<Response> {
  const rawBody = await request.text()

  try {
    const event = await routa.webhooks.constructEvent(
      rawBody,
      request.headers.get('routa-signature'),
      signingSecret
    )

    switch (event.type) {
      case 'message.delivered':
        console.log('delivered', event.data)
        break
      case 'message.failed':
        console.log('failed', event.data)
        break
    }

    return new Response(null, { status: 200 })
  } catch (error) {
    if (error instanceof RoutaSignatureVerificationError) {
      return new Response('Invalid signature', { status: 400 })
    }
    throw error
  }
}
```

Event types the SDK knows include `message.accepted`, `message.sent`, `message.delivered`, `message.read`, `message.failed`, `message.received`, `channel.status_changed` and `template.*` (`submitted`, `pending`, `approved`, `rejected`, `paused`, `disabled`, `failed`, `category_changed`, `updated`, `deleted`). Every event also carries `externalRef`, the project's own `external_ref` or `null`. An event type introduced after your installed version still parses; it arrives as a generic event with a plain `string` `type` and `unknown` `data`, so it is safe to ignore.

While a secret is being rotated, pass both to accept either: `constructEvent(rawBody, header, [newSecret, oldSecret])`.

If your endpoint was down, `routa.events.list()` returns the events you missed.

## Error handling

Every error the API returns is thrown as a `RoutaApiError` or one of its subclasses. All of them carry `code`, `statusCode`, `requestId` (quote it when contacting support) and, when the API sent them, `docUrl`, `type` (the API's error category, such as `billing_error`) and `details` (machine-readable values some errors define).

| HTTP status | Class | Extra fields |
| --- | --- | --- |
| 401 | `RoutaAuthenticationError` | — |
| 402 | `RoutaBillingError` | `limit`, `used`, `resetsAt` — only for the codes that define them (see below) |
| 403, 404, 422 | `RoutaInvalidRequestError` | `param` — the request field at fault, when known |
| 409 | `RoutaConflictError` | `reason` — what stands in the way, when the API says |
| 429 | `RoutaRateLimitError` | `retryAfter` — seconds to wait, when the server sent it |
| anything else (5xx, …) | `RoutaApiError` | — |

A `402` means the plan or payment state refused the request: `free_messages_exhausted` and `message_quota_exceeded` carry `limit` and `used` (the latter also `resetsAt`), `project_limit_exceeded` and `channel_limit_exceeded` carry `limit`, and `subscription_required` and `payment_failed` carry no numbers. Each field is `undefined` when the code does not define it.

```ts
import {
  RoutaApiError,
  RoutaAuthenticationError,
  RoutaBillingError,
  RoutaConflictError,
  RoutaInvalidRequestError,
  RoutaRateLimitError,
} from '@routa-chat/sdk'

try {
  await routa.messages.send({
    channel: 'chan_...',
    to: '+5581999999999',
    text: 'Olá!',
  })
} catch (error) {
  if (error instanceof RoutaAuthenticationError) {
    // Missing, invalid or revoked API key. Retrying will not help.
  } else if (error instanceof RoutaBillingError) {
    // Out of free messages or plan allowance: stop sending until it is fixed.
    console.error(`Blocked (${error.code}): ${error.used ?? '?'}/${error.limit ?? '?'}`)
  } else if (error instanceof RoutaConflictError) {
    console.error(`Conflict (${error.code}): ${error.message}`)
  } else if (error instanceof RoutaRateLimitError) {
    console.warn(`Rate limited; retry in ${error.retryAfter ?? '?'}s`)
  } else if (error instanceof RoutaInvalidRequestError) {
    console.error(`Rejected (${error.code}) on field ${error.param ?? 'n/a'}: ${error.message}`)
  } else if (error instanceof RoutaApiError) {
    console.error(error.statusCode, error.code, error.requestId)
  } else {
    throw error
  }
}
```

Two things are not covered by these classes:

- **Network failures and timeouts**, once retries are exhausted, reject with a plain `Error` whose `name` is `'HttpRequestError'`. The class is not exported yet, so check `error.name` rather than using `instanceof`.
- **Invalid configuration**, such as an empty `apiKey`, throws a plain `Error` synchronously from the `Routa` constructor.

## Configuration

```ts
import { Routa } from '@routa-chat/sdk'

const routa = new Routa({
  apiKey: 'rt_live_...',
  timeout: 10_000, // ms per attempt
  maxRetries: 2, // retries after the first attempt
})
```

| Option | Default | Description |
| --- | --- | --- |
| `apiKey` | — (required) | Bearer credential. |
| `baseURL` | Routa production API | Origin requests are sent to. Set it to point the client at another host, such as a staging environment or a local instance: `baseURL: 'http://localhost:3000'`. |
| `timeout` | `30000` | Timeout for each attempt, in milliseconds. |
| `maxRetries` | `3` | Retries after the first attempt. `0` disables retrying. |
| `logger` | no-op | An object with `debug`, `warn` and `error` methods. It receives request diagnostics such as retries. It never receives your API key or request and response bodies, and the SDK never writes to `console` itself. |
| `fetch` | global `fetch` | Replaces the `fetch` used for every request, for example to inject a proxy agent or a test double. |

**Retries.** The client retries network failures, `429`, `5xx`, and a `409` that means an identical request is still in flight. It waits with exponential backoff and jitter, and honors `Retry-After` when the server sends it. Other `4xx` responses are never retried — including `402` (a billing refusal lasts until the plan changes) and every `409` except the in-flight one.

**Idempotency.** `messages.send()` sends an `Idempotency-Key` automatically and reuses it on every retry, so a retried send cannot create a second message. Pass your own with `send({ ..., idempotencyKey })`. When a call returns the result of an earlier attempt, `message._replayed` is `true`. The server deduplicates only `messages.send()`; set `maxRetries: 0` if you need to avoid retries on other write calls.

## Partner API (experimental)

> **Experimental.** `@routa-chat/sdk/partner` may change in a minor release until an external partner has used it. The Partner API also exists only for plans that include it: that is granted by Routa, not something you can switch on, and without it every call answers `404 partner_api_not_available`.

If you run a platform that resells WhatsApp to its own customers, the Partner API provisions one project per customer, tied to your own id for them (`externalRef`). It lives in its own entry point on purpose: a partner key reaches **every** customer of yours (see [Security](#partner-api-security)), so importing it should be a visible, greppable act, and `Routa` loads none of it.

```ts
import { RoutaPartner } from '@routa-chat/sdk/partner'

const partner = new RoutaPartner('rt_partner_...')
```

`new RoutaPartner('rt_partner_...')` is shorthand for `new RoutaPartner({ partnerKey: 'rt_partner_...' })`, and the other options (`baseURL`, `timeout`, `maxRetries`, `logger`, `fetch`) are the same as `Routa`'s. The credential is `partnerKey`, never `apiKey`: a project API key is refused at construction, with a message that points you to `Routa`, and `Routa` refuses a partner key the same way.

A partner key **never sends a message**. After onboarding, a customer's traffic uses that project's own API key, with `Routa`.

**What a person does once, in the dashboard (Settings → Partner).** Your plan must include the Partner API; then create the partner profile (you get your `ptn_…` partner id and the **signing secret**, shown once), register the **redirect origins** your links may send customers back to, and issue a **partner key** (`rt_partner_…`, shown once). The API cannot do any of this for you, by design: a leaked key must not be able to replace itself.

### From a customer to a connected number

The cycle: create the customer's project, issue its API key, sign the link the customer opens to connect their number, confirm through the API, then send with that key.

```ts
import { Routa } from '@routa-chat/sdk'
import {
  buildOnboardingLink,
  RoutaPartner,
} from '@routa-chat/sdk/partner'

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}

const partner = new RoutaPartner(required('ROUTA_PARTNER_KEY'))

// 1 and 2: the customer's project and its API key. Run them on your server,
// once per customer, when they sign up.
async function provision(customerId: string, customerName: string) {
  // `customerId` is YOUR id for the customer: it is the project's `externalRef`.
  // Repeating the call returns the same project (`created` is false).
  const { project } = await partner.projects.create({
    name: customerName,
    externalRef: customerId,
  })

  // Needs the `api_keys:write` scope. The secret comes back ONCE: store it
  // now, in your secret store. Not safe to retry (see below).
  const key = await partner.projects.apiKeys.create(project.id, {
    name: customerName,
    scopes: ['messages:write', 'messages:read'], // the narrowest set that works
  })

  return { projectId: project.id, projectApiKey: key.secret }
}

// 3: sign the link WHEN THE CUSTOMER CLICKS (it is good for ten minutes), on
// your server. The signing secret never leaves it.
async function connectLink(customerId: string): Promise<string> {
  return buildOnboardingLink({
    partnerId: required('ROUTA_PARTNER_ID'), // ptn_…
    signingSecret: required('ROUTA_PARTNER_SIGNING_SECRET'),
    externalRef: customerId,
    redirectUrl: 'https://app.example.com/connected', // an origin you registered
    state: 'a-value-you-check-against-the-customers-session',
  })
}

// 4: confirm through the API. The redirect back to your `redirectUrl` is a
// hint, never proof: anyone can forge that request. Read the project instead.
async function isConnected(customerId: string): Promise<boolean> {
  const found = await partner.projects.list({ externalRef: customerId }).page()
  const project = found.data[0]
  if (!project) {
    return false
  }
  const detail = await partner.projects.retrieve(project.id)
  return detail.channels.some(channel => channel.status === 'active')
}

// 5: from here on, the customer's traffic uses the project's key, not the partner key.
function forCustomer(projectApiKey: string): Routa {
  return new Routa(projectApiKey)
}
```

Open the link with `window.open` from your page, or in a new tab: the page that opens is Routa's, and Meta's own dialog cannot run in an iframe. When the attempt ends, the customer's browser is sent to your `redirectUrl` with your `state` unchanged, plus `status`, `project_id` and `channel_id` (or `error`). Check `state` against the customer's session, then confirm as in step 4.

`buildOnboardingLink()` is a pure function: it makes no request and uses Web Crypto only. It also validates its input and throws on what the API would refuse **silently**: the API answers every bad link with the same "this link is not valid" page and no reason, so this is the only place you learn why.

To see your customers' numbers without one call per project, `partner.channels.list()` pages the channels of every project you made. It filters by `status` (`pending`, `active`, `degraded`, `disabled`), `projectId` and `externalRef`, and `partner.projects.list({ hasChannel: false })` finds the projects that never finished the link.

To hear about every customer in one place, register the organization's one webhook with `partner.webhook.set()` (it needs the opt-in `webhooks:write` scope) and keep the secret it returns once. Verify each delivery with `partner.webhook.constructEvent(rawBody, header, secret)`: it is the same check as `routa.webhooks.constructEvent()`, with no network call and no `Routa` needed, and the event's `projectId` and `externalRef` say which customer it is about.

**This cycle is not run by this repository's tests.** The partner key, the signing secret and the partner id come from the dashboard, and the test suite cannot provision them, so the conformance suite covers the API calls (the project, its key, the channel listing, the deletion) but not the signed link opened by a customer, and the README block above is type-checked, not run.

### Rough edges worth knowing

- **`apiKeys.create()` and `apiKeys.rotate()` are not safe to retry.** The API ignores `Idempotency-Key` on them, and the client retries a request whose response never arrived: a lost response can leave two keys issued, or rotate twice and leave you with a secret that is already replaced. If that matters more to you than riding out a network failure, build a client with `maxRetries: 0` for these calls (`new RoutaPartner({ partnerKey, maxRetries: 0 })`). Creating a *project* is different: it is idempotent by `externalRef`.
- **`projects.delete()` may not be done in one call.** It answers `{ status: 'deleted' }`, or `{ status: 'deleting', projectId }` when the project was large and only part of it was erased; call again until it answers `deleted`. Deleting needs the opt-in `projects:delete` scope, and a project with a channel that is not `disabled` answers `409 project_not_deletable` (`RoutaConflictError`, with `details.reason`).
- **`partner_api_not_available` is a `RoutaInvalidRequestError`** (`404`), with `code: 'partner_api_not_available'`: the plan has no Partner API, or has lapsed. Check `error.code`, not the class alone.
- **There is no "confirm channel" method.** Confirming an onboarding is a read, as in step 4. If you have no webhook yet, poll `projects.retrieve()` (or `channels.list({ externalRef })`) with a sensible back-off and a deadline; a customer may never finish.
- **Sign on click.** A link signed when you send an email is expired by the time it is read. Host a redirector of your own that signs when the customer clicks.

### Partner API security

Treat `ROUTA_PARTNER_KEY` as a root credential.

- **What a leaked partner key reaches.** With the `api_keys:write` scope it can issue a project API key with `messages:write` for *any* project of your organization, so it reaches the send path of **every one of your customers**. That is the price of provisioning by API. Without that scope it can still read and create projects. It never reads a secret that already exists (keys are shown once), never sends a message itself, and never creates or changes a partner key, a signing secret or a redirect origin. Every action taken through it is audited with the key as the actor, and you can revoke it at once in the dashboard.
- **Give it the narrowest scope.** A new partner key has `projects:read` and `projects:write` only. `api_keys:write`, `webhooks:write`, `channels:write` and `projects:delete` are opt-in: ask for each one on purpose, and for a job that needs a single scope (a report that reads projects) issue a key that has only that.
- **Restrict it to your servers and give it an expiry.** Set `ipAllowlist` to the addresses your servers call from (the dashboard recommends it when `api_keys:write` is granted) and an expiry, and rotate the key on a schedule. The same goes for the keys you issue with `apiKeys.create()`: pass `ipAllowlist` and `expiresAt`.
- **Never in the browser.** The partner key and the **signing secret** belong to your server, never to a web page, a mobile app, a front-end bundle or a public repository. The browser only ever receives the finished link: your server signs it, when the customer clicks, and hands the URL back. Anything that runs on your customer's device must be assumed readable by them.
- **Keep it out of logs and source control.** Read it from the environment or a secret manager. The client never writes it to a log, an error message or a `logger` call.

## Node.js support

Node.js **22 or later** (`engines.node` is `>=22`). The package ships both ESM and CommonJS builds with bundled type declarations, so it works with `import` and `require`. It relies on the platform `fetch` and Web Crypto APIs and has no runtime dependencies. TypeScript users get strict types for every request and response.

## Upgrading from 0.2.0

0.3.0 matches the SDK's types to the API's current contract. The SDK is 0.x, so changes to a public type ship as a minor; nothing was removed or renamed. The full list is in [CHANGELOG.md](CHANGELOG.md). What can stop your code compiling:

- **`TemplateStatus` has a new member, `'failed'`**: Routa could not submit the template to WhatsApp. A `switch` over the status that ends in a `never` check needs the new case; `failureCode` and `failureDetail` say why.
- **`EventType` goes from 13 to 17 members**: `template.failed`, `template.category_changed`, `template.updated` and `template.deleted` are new, and an exhaustive `switch (event.type)` must handle them.
- **New required fields.** Reading a value is unaffected, but anything that *builds* one yourself, such as a test fixture, must supply them. `Template`: `bodyText` (`string | null`), `failureCode`, `failureDetail`, `deletionRequested`, `deletionFailureDetail`, `origin`, `readOnly` and `unsupportedComponents`; `components` is optional and absent for a body-only template. `Message`: `origin` (`'api'`, `'business_app'`, or `null` for an inbound message) and `failureCode`. Every event: `externalRef`, the project's `external_ref` or `null`.
- **`402` and `409` have their own error classes**, `RoutaBillingError` and `RoutaConflictError`. Both extend `RoutaApiError`, so a `catch` on `RoutaApiError` still catches them; only code that compared `error.constructor` against `RoutaApiError` for these statuses notices. See [Error handling](#error-handling).

```ts
import type { Template } from '@routa-chat/sdk'

function report(template: Template) {
  if (template.status === 'failed') {
    console.error(template.failureCode, template.failureDetail)
  }
  // `components` may be absent: guard it before reading header, footer or buttons.
  console.log(template.bodyText, template.components?.buttons?.length ?? 0)
}
```

New in 0.3.0: [`media.upload()`](#upload-media), and [`templates.uploadMedia()` with `components` on `templates.submit()`](#create-a-template).

## Not supported yet

Be aware of these gaps before you build on the SDK:

- **Sending media, location or reactions.** `messages.send()` accepts only `text` and `template`. You can [upload media](#upload-media) and keep its `id`, but no message can reference it yet. Received and historical messages of these kinds are readable, but you cannot send them.
- **Editing, deleting or syncing templates.** You can submit, read and list them, but changing or removing one is dashboard-only: the API does not offer it to an API key.
- **Channels.** There is no `routa.channels` namespace. Connect and manage channels in the dashboard, then pass the channel id to `send()`.

## Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/routa-chat/routa-nodejs-sdk/issues). See [CONTRIBUTING.md](CONTRIBUTING.md) for the checks a change must pass and for which tests run without access to the Routa API.

## License

[MIT](https://github.com/routa-chat/routa-nodejs-sdk/blob/master/LICENSE)
