# Release bootstrap (one-time, manual)

`release.yml` publishes via npm's [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
(OIDC) — no `NPM_TOKEN` or `NODE_AUTH_TOKEN` anywhere in CI. But npm only lets you configure a
Trusted Publisher on a package that **already exists** in the registry, and `@routa-chat/sdk` has
never been published. So the very first release has to happen by hand, once, outside CI. Every
release after that goes through `release.yml` on its own.

This is not something CI can do for you — it needs a human logged in to an npm account with
publish access to the `routa-chat` org, with 2FA.

## Steps

1. **Log in to npm locally**

   ```
   npm login
   ```

   Use an account with publish access to the `routa-chat` org and 2FA enabled.

2. **Make sure your local npm CLI is new enough**

   Trusted publishing needs npm CLI ≥ 11.5.1. Update and check:

   ```
   npm install -g npm@latest
   npm --version
   ```

3. **Build**

   ```
   pnpm run build
   ```

4. **Publish the first version manually**

   ```
   npm publish --access public
   ```

   Deliberately **without** `--provenance`: real provenance attestation only happens when npm
   runs inside CI/CD with an OIDC exchange (a GitHub Actions run, here) — there's no OIDC identity
   to attest to on a local machine. Note what your npm CLI actually does with the flag on a local
   publish (as of this writing, it doesn't error — it silently produces a publish with no
   provenance attached) so this doc can be corrected if that behavior changes.

5. **Configure the Trusted Publisher on npmjs.com**

   Now that the package exists in the registry:

   - Go to `npmjs.com` → your package → **Settings** → **Trusted Publisher**
   - Select **GitHub Actions**
   - Fill in:
     - **Organization or user**: `routa-chat`
     - **Repository**: `routa-nodejs-sdk`
     - **Workflow filename**: `release.yml`
     - **Environment name**: leave this **blank**. `release.yml`'s `release` job does not
       declare a GitHub Actions `environment:`, so there is nothing to enter here. If a future
       edit to the job adds one, this field must be updated to match it or the OIDC exchange
       will fail.

6. **From here on, releases are automatic**

   Merging the "Version Packages" PR (opened and kept up to date by `changesets/action` on every
   push to `master` that has pending changesets) triggers `release.yml`, which publishes via
   trusted publishing with no token, ever, involved.

## After the first CI-published release

`release.yml`'s "Verify published version and OIDC provenance" step now checks this for you
automatically on every release after the first: it queries `npm view <name>@<version>
dist.attestations --json` for the exact version this run published and fails the job if that
field is empty. That field is only populated when a publish went through a real OIDC exchange
with provenance — a plain token publish (like this bootstrap one) never sets it.

Still worth checking by hand once, though: after that first CI-published release, look at the
**Provenance** badge on `https://www.npmjs.com/package/@routa-chat/sdk` and confirm it's present.
If the CI job passed but the badge is missing, that's a sign the automated check itself has a gap
(e.g. npm's response shape changed) rather than that the release is untrustworthy — worth
investigating either way.
