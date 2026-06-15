# Contributing

Thanks for helping improve the SimplyForms client!

## Setup

Requires **Node 20+** and **pnpm** (the version is pinned in `package.json` via `packageManager`;
[corepack](https://nodejs.org/api/corepack.html) will pick it up automatically).

```bash
pnpm install
```

## Repo layout

```
packages/
  sdk/   # the client — published as "@simplyforms/sdk"
```

It's a pnpm workspace with a single package today; the layout leaves room for more later.

## Everyday commands

```bash
pnpm -r build         # build (tsup → ESM + CJS + types + CDN IIFE)
pnpm -r typecheck     # tsc --noEmit
pnpm -r test          # vitest
pnpm -r test:cov      # coverage
pnpm lint             # biome check (lint + format check)
pnpm format           # biome format --write
pnpm -r check:exports # publint + are-the-types-wrong
```

Tests live in `packages/sdk/test/*.test.ts`. The client takes an injectable `fetch`, so tests
never hit the network.

## Runtime dependencies

The published client must stay **dependency-free** — it relies only on Web-standard globals
(`fetch`, `FormData`, `Blob`, `AbortController`). Please don't add runtime `dependencies`.

## Changesets & releases

We use [changesets](https://github.com/changesets/changesets).

1. Make your change with tests.
2. `pnpm changeset` — pick the bump (**minor** for features, **patch** for fixes/polish) and
   describe it.
3. Open a PR. CI runs lint, build, typecheck, tests, and export checks across the Node matrix.

On merge to `main`, the release workflow opens a "Version Packages" PR. Merging that PR publishes
`@simplyforms/sdk` to npm via **OIDC Trusted Publishing with provenance** (no tokens), tags the
release, and attaches an SBOM.

## Local end-to-end check (optional)

A live submit against a real staging form needs a form ID. Keep it out of git with
[hushenv](https://github.com/hushenv/hushenv) and run your script via `hushenv run -- …` so the
value is injected at runtime only. Never commit form IDs or tokens.
