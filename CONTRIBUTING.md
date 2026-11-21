# Contributing

Issues and pull requests are welcome. This guide covers the checks a change has to pass and, because it surprises people, what the conformance tests are and when they run.

## Setup

The repository pins its package manager (`packageManager` in `package.json`); use [pnpm](https://pnpm.io) at that version. Node.js 22 or later is required.

```bash
pnpm install
pnpm check   # typecheck, lint, tests, type tests, build
```

`pnpm check` is what CI runs on every pull request, and it needs nothing beyond the repository: no API key, no network, no running Routa instance.

## Commits and releases

- Commits follow [Conventional Commits](https://www.conventionalcommits.org), in English: `fix(message): ...`, `test(http): ...`.
- A change to the published package needs a changeset (`pnpm changeset`). While the version is 0.x, a breaking change to the public API is a **minor**.

## Two kinds of tests

| | Where | Needs the Routa API | Runs in CI |
| --- | --- | --- | --- |
| Unit and type tests | `tests/unit`, `tests/types` | No | Yes |
| Conformance tests | `tests/conformance` | Yes, for most of them | Skipped (see below) |

**Unit and type tests are the gate for a pull request.** They use fake transports and local HTTP servers, so every contributor can run all of them. Write or update them for every change.

**Conformance tests check the SDK against a real Routa API instance**: the error envelope and `code` mapping, `Retry-After` handling, idempotency, webhook signatures. The Routa API is not open source, so outside contributors cannot run them. Maintainers do.

### How the conformance tests are skipped

A conformance test that needs the API is **skipped, not failed**, when its environment is missing. It is decided in `tests/conformance/support/environment.ts`:

1. **API reachable.** A request to `${ROUTA_TEST_BASE_URL}/docs/json` (default `http://localhost:3000`, 1 second timeout) must succeed. Any failure, including a timeout, skips every scenario that needs the API.
2. **Channel fixture.** Scenarios that need a message to be accepted also need `ROUTA_TEST_API_KEY`, `ROUTA_TEST_CHANNEL_ID` and `ROUTA_TEST_TO`. Without all three they are skipped. The channel needs the `text` and `template` capabilities (the template scenarios fail with `422 capability_unsupported` without the latter, they do not skip), and its project should be a `test` one: a live project is refused with `402` after its 10 free messages.
3. **Webhook signer.** The signature scenarios import the API's own signing code from the path in `ROUTA_SDK_CONFORMANCE_SIGNER_PATH`. Without it they are skipped.
4. **Media source URL** (optional). Uploading media by `sourceUrl` needs a small public PNG or JPEG the API is allowed to download (it refuses private and loopback addresses), in `ROUTA_TEST_MEDIA_SOURCE_URL`. Without it that one scenario is skipped.

Some conformance tests need none of this and always run. They use a local HTTP server that forces a `429` or a `402`, and the template header media scenarios provision their own project.

### Why a channel fixture is needed

The suite provisions everything it can over the same HTTP routes a dashboard uses: an organization, a project and API keys. It does **not** provision a channel, so every scenario that needs one depends on `ROUTA_TEST_CHANNEL_ID` and is skipped without it. This was checked against the reference API (`routa` at `db2b824`), not assumed:

- The only route that creates a channel is the Meta Embedded Signup flow (`POST /v1/projects/{projectId}/channels/embedded_signup/start`, then the callback), an OAuth round trip with Meta. It always creates a `whatsapp_cloud` channel.
- The `fake` provider exists and is registered in the API and the worker, but no route creates a channel that uses it. The only way to get one is to insert the row into Postgres directly (`tools/load-test/seed.ts` does). Provisioning through the database is a shortcut this suite does not take: it would need the database connection, and it would skip the very routes the SDK talks to.

What is skipped without the fixture: sending a message and reading `origin`/`failureCode` back, the Quickstart, the two idempotency `409`s, the event `externalRef`, and everything that submits a template (components, the `404 template_media_not_found`, the `422`s with `param`). Scenarios that need only a project (error mapping, rate limit, media upload, template header media upload) do not depend on it.

`402 billing_error` on `messages.send()` cannot be provoked against the reference API for the same reason, and for one more: the API resolves the channel first, and a test project is never refused for billing, so it takes a live project that has spent its free messages. Spending those on the fixture project would break every other scenario. The `402` scenario (`billing-error.test.ts`) therefore serves an assembled response from a local server, built from the documented error envelope; its header comment says so.

### README code blocks

`tests/unit/readme` compiles every `ts` block of `README.md` against the source, with the repository's strict compiler options. It type-checks and does not run them: the blocks hold placeholders (`rt_live_...`, `chan_...`) and need a real channel. A block that no longer compiles fails `pnpm check`, with the README line it starts at.

### What this means for you

- **A green `pnpm check` does not mean the conformance tests ran.** Look for `skipped` in the test summary. In CI they always are.
- If your change touches retries, idempotency, error mapping, webhooks or request and response shapes, say so in the pull request. A maintainer will run the conformance tests against a real instance before merging, and may ask for changes based on the result.
- You do not need the API to contribute. Do not weaken or delete a conformance test because you cannot run it.

## Running the conformance tests (maintainers)

With a local Routa API instance running, `pnpm test` picks it up on its own.

Each run signs up a few organizations on that instance (5, or 6 with the webhook signer configured). The API limits sign-ups to 5 an hour per IP by default, so a second run within the hour fails with an error that names the limit. To run the suite repeatedly, start the API with a higher limit:

```bash
# in apps/api of the Routa repository
AUTH_RATE_LIMIT_SIGNUP_IP_LIMIT=1000 bun run dev
```

The API keeps that counter in Redis, so restarting it alone does not clear a limit that was already hit: raise the limit, or wait for the window (`AUTH_RATE_LIMIT_SIGNUP_IP_WINDOW_SECONDS`, one hour by default) to pass.
