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
  to: '+5581999999999', // recipient, E.164
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
  console.log(message.id, message.from, message.content)
}
```

To control paging yourself, ask for one page at a time:

```ts
const page = await routa.messages.list({ limit: 20 }).page()
console.log(page.data.length, page.hasMore, page.nextCursor)
```

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

Event types the SDK knows include `message.accepted`, `message.sent`, `message.delivered`, `message.read`, `message.failed`, `message.received`, `channel.status_changed` and `template.*`. An event type introduced after your installed version still parses; it arrives as a generic event with a plain `string` `type` and `unknown` `data`, so it is safe to ignore.

While a secret is being rotated, pass both to accept either: `constructEvent(rawBody, header, [newSecret, oldSecret])`.

If your endpoint was down, `routa.events.list()` returns the events you missed.

## Error handling

Every error the API returns is thrown as a `RoutaApiError` or one of its subclasses. All of them carry `code`, `statusCode`, `requestId` (quote it when contacting support) and, when the API sent one, `docUrl`.

| HTTP status | Class | Extra fields |
| --- | --- | --- |
| 401 | `RoutaAuthenticationError` | — |
| 403, 404, 422 | `RoutaInvalidRequestError` | `param` — the request field at fault, when known |
| 429 | `RoutaRateLimitError` | `retryAfter` — seconds to wait, when the server sent it |
| anything else (409, 5xx, …) | `RoutaApiError` | — |

```ts
import {
  RoutaApiError,
  RoutaAuthenticationError,
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

**Retries.** The client retries network failures, `429`, `5xx`, and a `409` that means an identical request is still in flight. It waits with exponential backoff and jitter, and honors `Retry-After` when the server sends it. Other `4xx` responses are never retried.

**Idempotency.** `messages.send()` sends an `Idempotency-Key` automatically and reuses it on every retry, so a retried send cannot create a second message. Pass your own with `send({ ..., idempotencyKey })`. When a call returns the result of an earlier attempt, `message._replayed` is `true`. The server deduplicates only `messages.send()`; set `maxRetries: 0` if you need to avoid retries on other write calls.

## Node.js support

Node.js **22 or later** (`engines.node` is `>=22`). The package ships both ESM and CommonJS builds with bundled type declarations, so it works with `import` and `require`. It relies on the platform `fetch` and Web Crypto APIs and has no runtime dependencies. TypeScript users get strict types for every request and response.

## Not supported yet

Be aware of these gaps before you build on the SDK:

- **Media upload.** `routa.media.retrieve(id)` works, but there is no `media.upload()`.
- **Sending media, location or reactions.** `messages.send()` accepts only `text` and `template`. Received and historical messages of these kinds are readable, but you cannot send them.
- **Channels.** There is no `routa.channels` namespace. Connect and manage channels in the dashboard, then pass the channel id to `send()`.

## Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/routa-chat/routa-nodejs-sdk/issues).

## License

[MIT](https://github.com/routa-chat/routa-nodejs-sdk/blob/master/LICENSE)
