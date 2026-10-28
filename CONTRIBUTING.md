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
2. **Channel fixture.** Scenarios that need a message to be accepted also need `ROUTA_TEST_API_KEY`, `ROUTA_TEST_CHANNEL_ID` and `ROUTA_TEST_TO`. Without all three they are skipped.
3. **Webhook signer.** The signature scenarios import the API's own signing code from the path in `ROUTA_SDK_CONFORMANCE_SIGNER_PATH`. Without it they are skipped.

Some conformance tests need none of this and always run. They use a local HTTP server that forces a `429`.

### What this means for you

- **A green `pnpm check` does not mean the conformance tests ran.** Look for `skipped` in the test summary. In CI they always are.
- If your change touches retries, idempotency, error mapping, webhooks or request and response shapes, say so in the pull request. A maintainer will run the conformance tests against a real instance before merging, and may ask for changes based on the result.
- You do not need the API to contribute. Do not weaken or delete a conformance test because you cannot run it.

## Running the conformance tests (maintainers)

With a local Routa API instance running, `pnpm test` picks it up on its own.

Each run signs up a few organizations on that instance (3, or 4 with the webhook signer configured). The API limits sign-ups to 5 an hour per IP by default, so a second run within the hour fails with an error that names the limit. To run the suite repeatedly, start the API with a higher limit:

```bash
# in apps/api of the Routa repository
AUTH_RATE_LIMIT_SIGNUP_IP_LIMIT=1000 bun run dev
```

The API keeps that counter in Redis, so restarting it alone does not clear a limit that was already hit: raise the limit, or wait for the window (`AUTH_RATE_LIMIT_SIGNUP_IP_WINDOW_SECONDS`, one hour by default) to pass.
