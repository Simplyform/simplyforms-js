# SimplyForms JavaScript client

[![CI](https://github.com/simplyform/simplyforms-js/actions/workflows/ci.yml/badge.svg)](https://github.com/simplyform/simplyforms-js/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/simplyform/simplyforms-js/badge)](https://securityscorecards.dev/viewer/?uri=github.com/simplyform/simplyforms-js)
[![npm](https://img.shields.io/npm/v/simplyforms.svg)](https://www.npmjs.com/package/simplyforms)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/simplyforms.svg)](https://www.npmjs.com/package/simplyforms)

The official JavaScript/TypeScript client for [SimplyForms](https://www.simplyforms.dev) —
submit form data with one call from the **browser, Node 20+, Bun, Deno, or any Edge runtime**.
Zero dependencies, typed errors, built-in retries and timeouts, published with provenance.

```bash
npm install simplyforms
```

```ts
import { SimplyForms } from 'simplyforms';

const sf = new SimplyForms('YOUR_FORM_ID');
await sf.submit({ email: 'jane@example.com', message: 'Hello!' });
```

📖 **Full usage docs:** [`packages/simplyforms/README.md`](./packages/simplyforms/README.md).

## Packages

| Package                                              | npm                                                             | Notes                                  |
| ---------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| [`simplyforms`](./packages/simplyforms)              | [`simplyforms`](https://www.npmjs.com/package/simplyforms)      | The client. Install this.              |
| [`@simplyforms/sdk`](./packages/sdk)                 | [`@simplyforms/sdk`](https://www.npmjs.com/package/@simplyforms/sdk) | Scoped alias; identical API.    |

Both are versioned in lockstep.

## Development

This is a [pnpm](https://pnpm.io) workspace.

```bash
pnpm install
pnpm -r build       # build both packages (tsup → ESM + CJS + types + CDN bundle)
pnpm -r test        # vitest
pnpm -r typecheck   # tsc --noEmit (run after build)
pnpm lint           # biome check
pnpm format         # biome format --write
pnpm -r check:exports # publint + are-the-types-wrong
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow and release process.

## Security

Published from CI via **npm Trusted Publishing (OIDC) with provenance** — no long-lived tokens.
See [SECURITY.md](./SECURITY.md) to report a vulnerability.

## License

[Apache-2.0](./LICENSE) © Simplyxity Ltd
