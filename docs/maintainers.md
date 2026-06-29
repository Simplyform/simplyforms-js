# Maintainer guide

Operational notes for releasing `@simplyforms/sdk`. Publishing is **staged** —
CI never makes a version public on its own; a maintainer approves it with 2FA.
Most of the setup below is one-time; the release runbook at the bottom is the
day-to-day part.

## One-time npm setup

### 1. Two-factor authentication (your npm account)

Approving a staged release requires a 2FA challenge. Enable 2FA on your npm
account (Account → Two-Factor Authentication → **Authorization and writes**)
before your first staged release, or `npm stage approve` will have nothing to
prompt against.

### 2. npm Trusted Publisher — switch to stage-only

Publishing uses npm **Trusted Publishing (OIDC)** — no tokens. The trusted
publisher on npmjs.com is bound to this repo **and the workflow filename
`publish.yml`**. That's why the workflow keeps that filename even though its
behavior changed. If you ever rename the workflow, update the trusted publisher
config on npmjs.com.

To force every CI release through staging, set the trusted publisher's
**"Allowed actions"** to **"Allow npm stage publish"**. Then nothing reaches the
public registry without a maintainer approving it with 2FA.

`publish.yml` already runs `npm stage publish`, so **"Allow npm stage publish"
must be enabled before the next release push, or staging fails with a permissions
error.** Enable it in this order so nothing breaks mid-flight:

1. On npmjs.com (`@simplyforms/sdk` → Settings → Trusted Publisher), **add**
   "Allow npm stage publish" while keeping "Allow npm publish". Non-breaking, and
   unblocks the workflow immediately.
2. Run one release end to end and confirm staging + approval work.
3. **Then** uncheck "Allow npm publish" for full stage-only.

Roll back by re-ticking "Allow npm publish" (and, if needed, reverting the
workflow to plain `npm publish`).

> Before the first staged release, make sure the currently-published version has
> a matching `vX.Y.Z` git tag. The tag step reads the version from
> `packages/sdk/package.json` and tags whatever is on `main` HEAD, so an
> already-public-but-untagged version could otherwise be tagged onto an unrelated
> later commit.

> `npm stage` requires **npm >= 11.15.0**, which is newer than the npm bundled
> with Node 24 (OIDC trusted publishing itself needs >= 11.5.1). The workflow
> runs `npm install -g npm@<pinned>` before the stage step. If staging fails
> with `Unknown command: "stage"`, that pin is missing or too old — bump it.

### 3. Actions permissions (required for the release PR)

The workflow uses the automatic `GITHUB_TOKEN` (you never create it), but the
repo must let Actions open pull requests, or the "Version Packages" PR can't be
created.

Settings → Actions → General → **Workflow permissions** → tick
**"Allow GitHub Actions to create and approve pull requests."**

## Release runbook

Releases are PR-driven, but going public requires an explicit approval step
(staged publishing) — CI never makes a version installable on its own.

1. **During development:** every user-facing PR includes a changeset
   (`pnpm changeset`; **minor** for features, **patch** for fixes).
2. **Merge to `main`:** the [publish workflow](../.github/workflows/publish.yml)
   opens or updates a **"Version Packages"** PR that bumps the version and
   rewrites the changelog.
3. **Cut the release:** review and **merge the "Version Packages" PR**. The
   workflow then builds + tests and **stages** `@simplyforms/sdk` to npm with
   provenance. **The package is not public yet.**
4. **Review the staged package** (needs 2FA on your account):
   - `npm stage list` — see what's staged; grab the `<stage-id>`.
   - `npm stage view <stage-id>` / `npm stage download <stage-id>` to inspect,
     or use the **Staged Packages** tab on npmjs.com.
5. **Approve** with 2FA:
   - `npm stage approve <stage-id>` (or the **Approve** button on npmjs.com).
   - This is the moment it becomes installable.
6. **Tag + GitHub Release:** re-run the workflow (Actions → **Publish Package**
   → **Run workflow**). Now the version is live on npm, so it creates the
   `vX.Y.Z` tag and the GitHub Release with the CycloneDX SBOM. Idempotent.
   **Do this before merging the next changeset PR** — the tag step is skipped
   while a new "Version Packages" PR is pending, so an approved-but-untagged
   version would otherwise sit untagged until you re-run with a clean `main`.
7. **Verify:** the npm page shows the new version with a provenance badge, and
   `npm i @simplyforms/sdk@latest` works.

Re-running the workflow is safe: already-published **and already-staged**
versions are skipped, and existing tags are no-ops.

### Manual fallback

If you ever need to version locally (CI down):

```bash
GITHUB_TOKEN=<token> pnpm changeset version   # bumps + writes the changelog
git commit -am "chore: version packages"
# push to main and let the workflow stage (then approve), or as a last resort
# stage by hand from packages/sdk (requires npm auth + 2FA):
pnpm -r build && pnpm -r test
cd packages/sdk && npm stage publish --access public   # then `npm stage approve`
```

> A hand-run `npm stage publish` produces **no provenance badge** (provenance
> needs CI/OIDC). Prefer the CI path; use this only when CI is down.
